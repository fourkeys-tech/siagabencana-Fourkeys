import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageDivision, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/api-errors";
import { assertCampActive } from "@/lib/camps";
import { refreshOperationalStatus } from "@/lib/inventory";
import { runSerializable } from "@/lib/transaction";
import { readJson } from "@/lib/http";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, validateOptionalText, validateText } from "@/lib/validation";
import { convertToBase, multiplyToBase, normalizeUnit, resolveUnitDefinition, type UnitDefinition } from "@/lib/unit-conversion";

type Params = {
    params: Promise<{ id: string }>;
};

// conversionStatus sengaja tidak diterima: status selalu diturunkan dari unit + faktor.
const UNIT_FIELDS = ["unit", "baseUnit", "unitDimension", "conversionFactor"] as const;
const STOCK_FIELDS = ["quantity", "status", "reservedQuantity", "damagedQuantity", "quantityBase", "reservedQuantityBase", "damagedQuantityBase"];

async function getItem(id: string) {
    return prisma.logisticsItem.findUnique({
        where: { id },
        include: { camp: { select: { id: true, name: true, status: true } } },
    });
}

// Dinormalisasi supaya barang lama dengan nama alias (mis. "kardus") dibandingkan sebagai "dus".
function itemDefinition(item: UnitDefinition): UnitDefinition {
    return { unit: normalizeUnit(item.unit), baseUnit: normalizeUnit(item.baseUnit), unitDimension: item.unitDimension, conversionFactor: item.conversionFactor, conversionStatus: item.conversionStatus };
}

function sameDefinition(a: UnitDefinition, b: UnitDefinition) {
    return a.unit === b.unit && a.baseUnit === b.baseUnit && a.unitDimension === b.unitDimension
        && a.conversionFactor === b.conversionFactor && a.conversionStatus === b.conversionStatus;
}

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const item = await getItem(id);

        if (!item) {
            return NextResponse.json(
                { success: false, message: "Data logistik tidak ditemukan." },
                { status: 404 },
            );
        }

        if (!canManageDivision(user, "LOGISTICS", item.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        return NextResponse.json({
            success: true,
            data: item,
        });
    } catch (error) {
        return handleRouteError(error, { context: "GET_LOGISTICS_ITEM_ERROR", fallback: "Gagal mengambil data." });
    }
}

export async function PUT(
    request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        // Pre-check hanya untuk 404/403; campId item tidak pernah berubah lewat endpoint ini.
        const current = await prisma.logisticsItem.findUnique({ where: { id }, select: { campId: true } });

        if (!current) {
            return NextResponse.json(
                { success: false, message: "Data logistik tidak ditemukan." },
                { status: 404 },
            );
        }

        if (!canManageDivision(user, "LOGISTICS", current.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        const body = await readJson(request);
        if (STOCK_FIELDS.some((field) => body[field] !== undefined)) {
            return NextResponse.json(
                { success: false, message: "Saldo stok dan status hanya dapat diubah melalui inventory movement." },
                { status: 400 },
            );
        }

        if (body.itemName !== undefined) {
            const nameError = validateText(body.itemName, "Nama barang", MAX_NAME_LENGTH);
            if (nameError) return NextResponse.json({ success: false, message: nameError }, { status: 400 });
        }

        const notesError = validateOptionalText(body.notes, "Catatan", MAX_NOTE_LENGTH);
        if (notesError) return NextResponse.json({ success: false, message: notesError }, { status: 400 });

        const conversionNoteError = validateOptionalText(body.conversionNote, "Catatan konversi", MAX_NOTE_LENGTH);
        if (conversionNoteError) return NextResponse.json({ success: false, message: conversionNoteError }, { status: 400 });

        if (body.minimumQuantity !== undefined) {
            const minimum = Number(body.minimumQuantity);
            if (!Number.isSafeInteger(minimum) || minimum < 0) {
                return NextResponse.json({ success: false, message: "Batas minimum harus bilangan bulat tidak negatif." }, { status: 400 });
            }
        }

        const hasUnitInput = UNIT_FIELDS.some((field) => body[field] !== undefined);

        // Saldo dibaca ulang di dalam transaksi: guard "unit terkunci saat ada stok" dan
        // kolom dasar baru harus memakai saldo yang sama dengan yang di-commit.
        const { updated, minimumQuantity, verification } = await runSerializable(async (tx) => {
            const item = await tx.logisticsItem.findUnique({ where: { id } });
            if (!item) throw new Error("LOGISTICS_ITEM_NOT_FOUND");
            await assertCampActive(item.campId, tx);

            const current = itemDefinition(item);
            const next = hasUnitInput ? resolveUnitDefinition(body, current) : current;
            const definitionChanged = !sameDefinition(next, current);
            const hasStock = item.quantity > 0 || item.reservedQuantity > 0 || item.damagedQuantity > 0
                || item.quantityBase > 0 || item.reservedQuantityBase > 0 || item.damagedQuantityBase > 0;
            // Verifikasi isi kemasan: barang yang dicatat per kemasan (NEEDS_REVIEW) mendapat faktor resmi
            // tanpa mengganti unitnya, sehingga saldo yang ada cukup dikalikan ulang ke unit dasar.
            const isVerification = definitionChanged && item.conversionStatus === "NEEDS_REVIEW"
                && next.conversionStatus === "CONFIGURED" && next.unit === current.unit;

            if (definitionChanged && hasStock && !isVerification) throw new Error("UNIT_LOCKED_BY_STOCK");
            if (isVerification) {
                // Reservasi & permintaan menyimpan snapshot definisi lama; mengubahnya akan membuat
                // kolom dasar distribusi tidak cocok dengan stok.
                const [activeDistributions, pendingRequests] = await Promise.all([
                    tx.distribution.count({ where: { sourceItemId: id, status: { in: ["APPROVED", "RESERVED"] } } }),
                    tx.logisticsRequest.count({ where: { sourceCampId: item.campId, status: "PENDING", unit: item.unit, itemName: { equals: item.itemName, mode: "insensitive" } } }),
                ]);
                if (item.reservedQuantity > 0 || item.reservedQuantityBase > 0 || activeDistributions > 0 || pendingRequests > 0) {
                    throw new Error("UNIT_VERIFY_BLOCKED");
                }
            }

            const minimum = body.minimumQuantity === undefined ? item.minimumQuantity : Number(body.minimumQuantity);
            const factor = next.conversionFactor;
            await tx.logisticsItem.update({
                where: { id },
                data: {
                    ...(body.itemName !== undefined && { itemName: String(body.itemName).trim() }),
                    ...(definitionChanged && {
                        unit: next.unit,
                        baseUnit: next.baseUnit,
                        unitDimension: next.unitDimension,
                        conversionFactor: factor,
                        conversionStatus: next.conversionStatus,
                        quantityBase: multiplyToBase(item.quantity, factor),
                        reservedQuantityBase: multiplyToBase(item.reservedQuantity, factor),
                        damagedQuantityBase: multiplyToBase(item.damagedQuantity, factor),
                    }),
                    ...(body.conversionNote !== undefined && { conversionNote: String(body.conversionNote ?? "").trim() || null }),
                    minimumQuantity: minimum,
                    minimumQuantityBase: minimum === 0 ? 0 : convertToBase(minimum, next),
                    ...(body.notes !== undefined && { notes: body.notes ? String(body.notes).trim() : null }),
                },
            });
            // Status operasional (CRITICAL/LOW/SUFFICIENT) langsung sinkron dengan batas minimum baru.
            await refreshOperationalStatus(tx, id);
            return {
                updated: await tx.logisticsItem.findUniqueOrThrow({ where: { id } }),
                minimumQuantity: minimum,
                verification: isVerification ? { oldUnit: item.unit, oldBaseUnit: item.baseUnit, oldFactor: item.conversionFactor } : null,
            };
        });

        if (verification) {
            await writeAuditLog({
                userId: user.id,
                action: "UNIT_VERIFY",
                entity: "LogisticsItem",
                entityId: id,
                details: { itemName: updated.itemName, unit: updated.unit, oldUnit: verification.oldUnit, oldBaseUnit: verification.oldBaseUnit, oldFactor: verification.oldFactor, newBaseUnit: updated.baseUnit, newFactor: updated.conversionFactor, quantityBase: updated.quantityBase },
            });
        } else {
            await writeAuditLog({ userId: user.id, action: "UPDATE", entity: "LogisticsItem", entityId: id, details: { itemName: updated.itemName, unit: updated.unit, minimumQuantity } });
        }

        return NextResponse.json({
            success: true,
            message: verification ? "Isi kemasan terverifikasi dan saldo dasar dihitung ulang." : "Data logistik berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
        return handleRouteError(error, {
            context: "UPDATE_LOGISTICS_ERROR",
            fallback: "Gagal memperbarui data logistik.",
            messages: { CAMP_NOT_ACTIVE: "Posko sudah ditutup sehingga tidak dapat memperbarui logistik." },
        });
    }
}

export async function DELETE(
    _request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const item = await getItem(id);

        if (!item) {
            return NextResponse.json(
                { success: false, message: "Data logistik tidak ditemukan." },
                { status: 404 },
            );
        }

        if (!canManageDivision(user, "LOGISTICS", item.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        // Item ber-reservasi atau punya riwayat mutasi tidak boleh hilang dari jejak stok.
        if (item.reservedQuantity > 0 || item.reservedQuantityBase > 0) {
            return NextResponse.json(
                { success: false, message: "Item masih dicadangkan untuk distribusi. Batalkan atau kirim distribusi terlebih dahulu." },
                { status: 409 },
            );
        }
        const movementCount = await prisma.inventoryMovement.count({ where: { logisticsItemId: id } });
        if (movementCount > 0) {
            return NextResponse.json(
                { success: false, message: "Item memiliki riwayat mutasi stok sehingga tidak dapat dihapus. Gunakan pergerakan stok Rusak/Buang jika tidak lagi dipakai." },
                { status: 409 },
            );
        }

        await prisma.logisticsItem.delete({
            where: { id },
        });

        await writeAuditLog({ userId: user.id, action: "DELETE", entity: "LogisticsItem", entityId: id, details: { itemName: item.itemName, campId: item.campId } });

        return NextResponse.json({
            success: true,
            message: "Data logistik berhasil dihapus.",
        });
    } catch (error) {
        return handleRouteError(error, {
            context: "DELETE_LOGISTICS_ERROR",
            fallback: "Gagal menghapus data logistik.",
            foreignKeyMessage: "Item terhubung dengan data lain sehingga tidak dapat dihapus.",
        });
    }
}
