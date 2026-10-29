import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { assertCampActive, campError } from "@/lib/camps";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, validateText } from "@/lib/validation";

type Params = {
    params: Promise<{ id: string }>;
};

const FACILITY_ACTIONS = ["REPORT_DAMAGE", "START_REPAIR", "COMPLETE_REPAIR", "MARK_REPLACEMENT"] as const;
type FacilityAction = typeof FACILITY_ACTIONS[number];

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const report = await prisma.facilityReport.findUnique({
            where: { id },
            include: { camp: { select: { id: true, name: true, status: true } } },
        });

        if (!report) {
            return NextResponse.json(
                { success: false, message: "Laporan tidak ditemukan." },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "SHELTER", report.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        return NextResponse.json({
            success: true,
            data: report,
        });
    } catch (error) {
        if (isAuthError(error)) return authError(error);
        console.error("GET_SHELTER_ITEM_ERROR", error);
        return NextResponse.json({ success: false, message: "Gagal mengambil laporan." }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const report = await prisma.facilityReport.findUnique({
            where: { id },
        });

        if (!report) {
            return NextResponse.json(
                { success: false, message: "Laporan tidak ditemukan." },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "SHELTER", report.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        await assertCampActive(report.campId);

        const body = await readJson(request);
        const action = String(body.action ?? "").toUpperCase() as FacilityAction;

        if (FACILITY_ACTIONS.includes(action)) {
            const noteError = validateText(body.note, "Catatan tindakan", MAX_NOTE_LENGTH);
            if (noteError) return NextResponse.json({ success: false, message: noteError }, { status: 400 });
            const note = String(body.note).trim();

            const nextStatus =
                action === "REPORT_DAMAGE" ? "DAMAGED" :
                action === "START_REPAIR" ? "REPAIRING" :
                action === "COMPLETE_REPAIR" ? "GOOD" : "DAMAGED";

            const validTransition =
                (action === "REPORT_DAMAGE" && report.status === "GOOD") ||
                (action === "START_REPAIR" && report.status === "DAMAGED") ||
                (action === "COMPLETE_REPAIR" && report.status === "REPAIRING") ||
                (action === "MARK_REPLACEMENT" && report.status !== "GOOD");

            if (!validTransition) {
                return NextResponse.json({ success: false, message: "Transisi status fasilitas tidak sesuai alur." }, { status: 409 });
            }

            const appendNote = `\n\n[${action}] ${note}`;
            const changed = await prisma.facilityReport.updateMany({
                where: { id, status: report.status, updatedAt: report.updatedAt },
                data: { status: nextStatus, description: `${report.description}${appendNote}`.slice(-4000) },
            });
            if (changed.count !== 1) {
                return NextResponse.json({ success: false, message: "Status fasilitas sudah berubah. Muat ulang data lalu coba lagi." }, { status: 409 });
            }

            const updated = await prisma.facilityReport.findUniqueOrThrow({ where: { id } });
            await writeAuditLog({
                userId: user.id,
                action: `FACILITY_${action}`,
                entity: "FacilityReport",
                entityId: id,
                details: { from: report.status, to: nextStatus, note },
            });

            return NextResponse.json({ success: true, message: "Tindakan fasilitas berhasil dicatat.", data: updated });
        }

        // Edit deskriptif (nama fasilitas, deskripsi awal): dilarang ubah status langsung
        if (body.status !== undefined && String(body.status).toUpperCase() !== report.status) {
            return NextResponse.json(
                { success: false, message: "Perubahan status harus memakai aksi perbaikan atau penggantian." },
                { status: 409 },
            );
        }

        const data: { facilityName?: string; description?: string } = {};
        if (body.facilityName !== undefined) {
            const nameError = validateText(body.facilityName, "Nama fasilitas", MAX_NAME_LENGTH);
            if (nameError) return NextResponse.json({ success: false, message: nameError }, { status: 400 });
            data.facilityName = String(body.facilityName).trim();
        }
        if (body.description !== undefined) {
            const descError = validateText(body.description, "Deskripsi fasilitas", MAX_NOTE_LENGTH);
            if (descError) return NextResponse.json({ success: false, message: descError }, { status: 400 });
            data.description = String(body.description).trim();
        }

        const updated = await prisma.facilityReport.update({
            where: { id },
            data,
        });

        await writeAuditLog({
            userId: user.id,
            action: "UPDATE",
            entity: "FacilityReport",
            entityId: id,
            details: { facilityName: updated.facilityName },
        });

        return NextResponse.json({
            success: true,
            message: "Laporan shelter berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
        if (isInvalidJson(error)) return invalidJsonResponse();
        if (isAuthError(error)) return authError(error);
        const knownCampError = campError(error);
        if (knownCampError) return NextResponse.json({ success: false, message: knownCampError.message }, { status: knownCampError.status });

        console.error("UPDATE_SHELTER_ERROR", error);
        return NextResponse.json({ success: false, message: "Gagal memperbarui laporan." }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const report = await prisma.facilityReport.findUnique({
            where: { id },
        });

        if (!report) {
            return NextResponse.json(
                { success: false, message: "Laporan tidak ditemukan." },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "SHELTER", report.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        // Petugas lapangan dilarang menghapus laporan fasilitas.
        if (user.role === "FIELD_OFFICER") {
            return NextResponse.json(
                { success: false, message: "Hanya Ketua Divisi Shelter, Manager, atau Super Admin yang dapat menghapus laporan." },
                { status: 403 },
            );
        }

        // Laporan fasilitas rusak/sedang diperbaiki adalah jejak triase; tidak boleh dihapus.
        if (report.status !== "GOOD") {
            return NextResponse.json(
                { success: false, message: "Fasilitas yang rusak atau sedang diperbaiki tidak boleh dihapus. Selesaikan perbaikan terlebih dahulu." },
                { status: 409 },
            );
        }

        await prisma.facilityReport.delete({
            where: { id },
        });

        await writeAuditLog({
            userId: user.id,
            action: "DELETE",
            entity: "FacilityReport",
            entityId: id,
            details: { campId: report.campId, facilityName: report.facilityName },
        });

        return NextResponse.json({
            success: true,
            message: "Laporan shelter berhasil dihapus.",
        });
    } catch (error) {
        if (isAuthError(error)) return authError(error);
        console.error("DELETE_SHELTER_ERROR", error);
        return NextResponse.json({ success: false, message: "Gagal menghapus laporan." }, { status: 500 });
    }
}
