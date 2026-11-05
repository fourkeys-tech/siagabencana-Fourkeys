import type { FacilityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageDivision, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/api-errors";
import { fail, ok } from "@/lib/api-response";
import { assertCampActive } from "@/lib/camps";
import { readJson } from "@/lib/http";
import { parseFacilityCategory, parseFacilityQuantity, type FacilityCategory } from "@/lib/shelter-standards";
import { runSerializable } from "@/lib/transaction";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, validateText } from "@/lib/validation";

type Params = {
    params: Promise<{ id: string }>;
};

const FACILITY_ACTIONS = ["REPORT_DAMAGE", "START_REPAIR", "COMPLETE_REPAIR", "MARK_REPLACEMENT"] as const;
type FacilityAction = (typeof FACILITY_ACTIONS)[number];

const MAX_DESCRIPTION_HISTORY = 4000;
const FORBIDDEN_MESSAGE = "Tidak memiliki akses ke divisi shelter posko ini.";

// Status tujuan + status asal yang sah untuk tiap tindakan.
const TRANSITIONS: Record<FacilityAction, { to: FacilityStatus; from: FacilityStatus[] }> = {
    REPORT_DAMAGE: { to: "DAMAGED", from: ["GOOD"] },
    START_REPAIR: { to: "REPAIRING", from: ["DAMAGED"] },
    COMPLETE_REPAIR: { to: "GOOD", from: ["REPAIRING"] },
    MARK_REPLACEMENT: { to: "DAMAGED", from: ["DAMAGED", "REPAIRING"] },
};

function isFacilityAction(value: string): value is FacilityAction {
    return (FACILITY_ACTIONS as readonly string[]).includes(value);
}

function appendHistory(description: string, entry: string) {
    return `${description}\n\n${entry}`.slice(-MAX_DESCRIPTION_HISTORY);
}

export async function GET(_request: Request, { params }: Params) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const report = await prisma.facilityReport.findUnique({
            where: { id },
            include: { camp: { select: { id: true, name: true, status: true } } },
        });
        if (!report) return fail("Laporan tidak ditemukan.", 404);
        if (!canManageDivision(user, "SHELTER", report.campId)) return fail(FORBIDDEN_MESSAGE, 403);

        return ok(report);
    } catch (error) {
        return handleRouteError(error, { context: "GET_SHELTER_ITEM_ERROR", fallback: "Gagal mengambil laporan." });
    }
}

export async function PUT(request: Request, { params }: Params) {
    try {
        const user = await requireAuth();
        const { id } = await params;
        const body = await readJson(request);
        const action = String(body.action ?? "").trim().toUpperCase();

        if (isFacilityAction(action)) {
            const noteError = validateText(body.note, "Catatan tindakan", MAX_NOTE_LENGTH);
            if (noteError) return fail(noteError, 400);
            const note = String(body.note).trim();

            // Lapor rusak sebagian: hanya untuk REPORT_DAMAGE; kosong = seluruh jumlah.
            let damagedQuantity: number | null = null;
            if (action === "REPORT_DAMAGE" && body.damagedQuantity !== undefined && body.damagedQuantity !== null && body.damagedQuantity !== "") {
                damagedQuantity = parseFacilityQuantity(body.damagedQuantity);
                if (damagedQuantity === null) return fail("Jumlah rusak harus bilangan bulat lebih dari 0.", 400);
            }

            const transition = TRANSITIONS[action];
            const result = await runSerializable(async (tx) => {
                const report = await tx.facilityReport.findUnique({ where: { id } });
                if (!report) throw new Error("FACILITY_NOT_FOUND");
                if (!canManageDivision(user, "SHELTER", report.campId)) throw new Error("FORBIDDEN");
                await assertCampActive(report.campId, tx);
                if (!transition.from.includes(report.status)) throw new Error("INVALID_FACILITY_TRANSITION");

                const entry = `[${action}] ${note}`;
                const partial = damagedQuantity !== null && damagedQuantity < report.quantity;
                if (damagedQuantity !== null && damagedQuantity > report.quantity) throw new Error("FACILITY_DAMAGE_EXCEEDS_QUANTITY");

                if (partial) {
                    // Sebagian unit rusak: baris asal tetap Baik dengan sisa jumlah, unit rusak dipisah ke baris baru
                    // supaya perhitungan kecukupan hanya menghitung unit yang benar-benar berfungsi.
                    const remaining = report.quantity - damagedQuantity!;
                    const updated = await tx.facilityReport.update({
                        where: { id },
                        data: {
                            quantity: remaining,
                            description: appendHistory(report.description, `[REPORT_DAMAGE] ${damagedQuantity} dari ${report.quantity} rusak, dipisah ke laporan baru. ${note}`),
                        },
                    });
                    const split = await tx.facilityReport.create({
                        data: {
                            campId: report.campId,
                            category: report.category,
                            facilityName: report.facilityName,
                            quantity: damagedQuantity!,
                            status: "DAMAGED",
                            description: `Dipisah dari laporan "${report.facilityName}" (${damagedQuantity} dari ${report.quantity}).\n\n${entry}`,
                        },
                    });
                    return { from: report.status, updated, split };
                }

                const updated = await tx.facilityReport.update({
                    where: { id },
                    data: { status: transition.to, description: appendHistory(report.description, entry) },
                });
                return { from: report.status, updated, split: null };
            });

            await writeAuditLog({
                userId: user.id,
                action: `FACILITY_${action}`,
                entity: "FacilityReport",
                entityId: id,
                details: {
                    from: result.from,
                    to: result.split ? result.from : transition.to,
                    note,
                    ...(result.split ? { damagedQuantity, splitReportId: result.split.id } : {}),
                },
            });

            const message = result.split
                ? `${result.split.quantity} unit dicatat rusak sebagai laporan terpisah. Sisa ${result.updated.quantity} tetap Baik.`
                : "Tindakan fasilitas berhasil dicatat.";
            return ok({ ...result.updated, splitReport: result.split }, message);
        }

        // Edit deskriptif (kategori, nama, jumlah, deskripsi awal): status hanya lewat tindakan.
        const data: { category?: FacilityCategory; facilityName?: string; quantity?: number; description?: string } = {};
        if (body.category !== undefined) {
            const category = parseFacilityCategory(body.category);
            if (!category) return fail("Kategori fasilitas tidak valid.", 400);
            data.category = category;
        }
        if (body.quantity !== undefined) {
            const quantity = parseFacilityQuantity(body.quantity);
            if (quantity === null) return fail("Jumlah fasilitas harus bilangan bulat lebih dari 0.", 400);
            data.quantity = quantity;
        }
        if (body.facilityName !== undefined) {
            const nameError = validateText(body.facilityName, "Nama fasilitas", MAX_NAME_LENGTH);
            if (nameError) return fail(nameError, 400);
            data.facilityName = String(body.facilityName).trim();
        }
        if (body.description !== undefined) {
            const descError = validateText(body.description, "Deskripsi fasilitas", MAX_NOTE_LENGTH);
            if (descError) return fail(descError, 400);
            data.description = String(body.description).trim();
        }

        const { before, updated } = await runSerializable(async (tx) => {
            const report = await tx.facilityReport.findUnique({ where: { id } });
            if (!report) throw new Error("FACILITY_NOT_FOUND");
            if (!canManageDivision(user, "SHELTER", report.campId)) throw new Error("FORBIDDEN");
            await assertCampActive(report.campId, tx);
            if (body.status !== undefined && String(body.status).toUpperCase() !== report.status) throw new Error("FACILITY_STATUS_REQUIRES_ACTION");
            return { before: report, updated: await tx.facilityReport.update({ where: { id }, data }) };
        });

        await writeAuditLog({
            userId: user.id,
            action: "UPDATE",
            entity: "FacilityReport",
            entityId: id,
            details: {
                facilityName: updated.facilityName,
                ...(before.category !== updated.category ? { category: { from: before.category, to: updated.category } } : {}),
                ...(before.quantity !== updated.quantity ? { quantity: { from: before.quantity, to: updated.quantity } } : {}),
            },
        });

        return ok(updated, "Laporan shelter berhasil diperbarui.");
    } catch (error) {
        return handleRouteError(error, {
            context: "UPDATE_SHELTER_ERROR",
            fallback: "Gagal memperbarui laporan.",
            forbiddenMessage: FORBIDDEN_MESSAGE,
        });
    }
}

export async function DELETE(_request: Request, { params }: Params) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const report = await prisma.facilityReport.findUnique({ where: { id } });
        if (!report) return fail("Laporan tidak ditemukan.", 404);
        if (!canManageDivision(user, "SHELTER", report.campId)) return fail(FORBIDDEN_MESSAGE, 403);

        // Petugas lapangan dilarang menghapus laporan fasilitas.
        if (user.role === "FIELD_OFFICER") {
            return fail("Hanya Ketua Divisi Shelter, Manager, atau Super Admin yang dapat menghapus laporan.", 403);
        }

        // Laporan fasilitas rusak/sedang diperbaiki adalah jejak triase; tidak boleh dihapus.
        // deleteMany bersyarat status supaya tindakan paralel (lapor rusak) tidak terhapus diam-diam.
        const deleted = await prisma.facilityReport.deleteMany({ where: { id, status: "GOOD" } });
        if (deleted.count !== 1) {
            return fail("Fasilitas yang rusak atau sedang diperbaiki tidak boleh dihapus. Selesaikan perbaikan terlebih dahulu.", 409);
        }

        await writeAuditLog({
            userId: user.id,
            action: "DELETE",
            entity: "FacilityReport",
            entityId: id,
            details: { campId: report.campId, category: report.category, quantity: report.quantity, facilityName: report.facilityName },
        });

        return ok(null, "Laporan shelter berhasil dihapus.");
    } catch (error) {
        return handleRouteError(error, { context: "DELETE_SHELTER_ERROR", fallback: "Gagal menghapus laporan." });
    }
}
