import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { assertCampActive, campError } from "@/lib/camps";
import { refreshOperationalStatus, runSerializable } from "@/lib/inventory";
import { isForeignKeyError, isSerializationConflict, SERIALIZATION_CONFLICT_MESSAGE } from "@/lib/prisma-errors";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, validateOptionalText, validateText } from "@/lib/validation";
import { assertUnitDefinition, convertToBase, defaultUnitDefinition, inferDimension, inferBaseUnit, normalizeUnit, type UnitConversionStatus, type UnitDimension } from "@/lib/unit-conversion";

type Params = {
    params: Promise<{ id: string }>;
};

async function getItem(id: string) {
    return prisma.logisticsItem.findUnique({
        where: { id },
        include: { camp: { select: { id: true, name: true, status: true } } },
    });
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

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "LOGISTICS", item.campId)) {
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
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_LOGISTICS_ITEM_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data." },
            { status: 500 },
        );
    }
}

export async function PUT(
    request: Request,
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

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "LOGISTICS", item.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        await assertCampActive(item.campId);

        const body = await readJson(request);
        const forbiddenFields = ["quantity", "status", "reservedQuantity", "damagedQuantity", "quantityBase", "reservedQuantityBase", "damagedQuantityBase"];
        if (forbiddenFields.some((field) => body[field] !== undefined)) {
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

        const hasUnitChange = ["unit", "baseUnit", "unitDimension", "conversionFactor", "conversionStatus"].some((field) => body[field] !== undefined);
        const minimumQuantity = body.minimumQuantity === undefined ? item.minimumQuantity : Number(body.minimumQuantity);
        if (!Number.isSafeInteger(minimumQuantity) || minimumQuantity < 0) {
            return NextResponse.json({ success: false, message: "Batas minimum harus bilangan bulat tidak negatif." }, { status: 400 });
        }
        const unit = normalizeUnit(body.unit ?? item.unit);
        const inferred = defaultUnitDefinition(unit);
        const baseUnit = normalizeUnit(body.baseUnit ?? (body.unit === undefined ? item.baseUnit : inferred.baseUnit ?? inferBaseUnit(unit)));
        const unitDimension = (body.unitDimension === "MASS" || body.unitDimension === "VOLUME" || body.unitDimension === "COUNT")
            ? body.unitDimension as UnitDimension
            : (body.unit === undefined ? item.unitDimension : inferred.unitDimension ?? inferDimension(baseUnit));
        const conversionFactor = Number(body.conversionFactor ?? (body.unit === undefined ? item.conversionFactor : inferred.conversionFactor));
        const conversionStatus: UnitConversionStatus = body.conversionStatus === "NEEDS_REVIEW"
            ? "NEEDS_REVIEW"
            : body.conversionStatus === "CONFIGURED" || (hasUnitChange && inferred.conversionStatus === "CONFIGURED")
                ? "CONFIGURED"
                : (hasUnitChange ? "NEEDS_REVIEW" : item.conversionStatus);
        const unitDefinition = assertUnitDefinition({ unit, baseUnit, unitDimension, conversionFactor, conversionStatus });
        const minimumQuantityBase = minimumQuantity === 0 ? 0 : convertToBase(minimumQuantity, unitDefinition);
        const definitionChanged = hasUnitChange && (
            unitDefinition.unit !== item.unit
            || unitDefinition.baseUnit !== item.baseUnit
            || unitDefinition.unitDimension !== item.unitDimension
            || unitDefinition.conversionFactor !== item.conversionFactor
            || unitDefinition.conversionStatus !== item.conversionStatus
        );
        if (definitionChanged && (item.quantity > 0 || item.reservedQuantity > 0 || item.damagedQuantity > 0 || item.quantityBase > 0 || item.reservedQuantityBase > 0 || item.damagedQuantityBase > 0)) {
            return NextResponse.json({ success: false, message: "Definisi unit tidak dapat diubah saat stok, reservasi, atau stok rusak masih tercatat. Gunakan alur rekonsiliasi inventory." }, { status: 409 });
        }

        // Perbarui item lalu refresh status operasional dalam satu transaksi Serializable
        // agar status (CRITICAL/LOW/SUFFICIENT) langsung sinkron dengan batas minimum baru.
        const updated = await runSerializable(async (tx) => {
            const res = await tx.logisticsItem.update({
                where: { id },
                data: {
                    ...(body.itemName !== undefined && { itemName: String(body.itemName).trim() }),
                    ...(body.unit !== undefined && { unit: unitDefinition.unit }),
                    ...(definitionChanged && {
                        baseUnit: unitDefinition.baseUnit,
                        unitDimension: unitDefinition.unitDimension,
                        conversionFactor: unitDefinition.conversionFactor,
                        conversionStatus: unitDefinition.conversionStatus,
                        quantityBase: item.quantity * unitDefinition.conversionFactor,
                        reservedQuantityBase: item.reservedQuantity * unitDefinition.conversionFactor,
                        damagedQuantityBase: item.damagedQuantity * unitDefinition.conversionFactor,
                    }),
                    ...(body.conversionNote !== undefined && { conversionNote: String(body.conversionNote ?? "").trim() || null }),
                    minimumQuantity,
                    minimumQuantityBase,
                    ...(body.notes !== undefined && { notes: body.notes ? String(body.notes).trim() : null }),
                },
            });
            await refreshOperationalStatus(tx, id);
            return tx.logisticsItem.findUniqueOrThrow({ where: { id } });
        });

        await writeAuditLog({ userId: user.id, action: "UPDATE", entity: "LogisticsItem", entityId: id, details: { itemName: updated.itemName, unit: updated.unit, minimumQuantity } });

        return NextResponse.json({
            success: true,
            message: "Data logistik berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
        if (isInvalidJson(error)) return invalidJsonResponse();
        if (isSerializationConflict(error)) return NextResponse.json({ success: false, message: SERIALIZATION_CONFLICT_MESSAGE }, { status: 409 });
        const knownCampError = campError(error);
        if (knownCampError) return NextResponse.json({ success: false, message: knownCampError.message }, { status: knownCampError.status });

        if (error instanceof Error && error.message === "INVALID_QUANTITY") {
            return NextResponse.json({ success: false, message: "Jumlah harus bilangan bulat lebih dari 0." }, { status: 400 });
        }
        if (error instanceof Error && error.message === "MOVEMENT_REASON_REQUIRED") {
            return NextResponse.json({ success: false, message: "Alasan wajib diisi." }, { status: 400 });
        }
        if (error instanceof Error && error.message === "INSUFFICIENT_AVAILABLE_STOCK") {
            return NextResponse.json({ success: false, message: "Stok tersedia tidak mencukupi." }, { status: 409 });
        }
        if (error instanceof Error && error.message === "LOGISTICS_ITEM_NOT_FOUND") {
            return NextResponse.json({ success: false, message: "Data logistik tidak ditemukan." }, { status: 404 });
        }
        if (error instanceof Error) {
            const unitMessages: Record<string, string> = {
                UNIT_REQUIRED: "Unit dan unit dasar wajib diisi.",
                UNIT_NOT_SUPPORTED: "Unit tidak tersedia di katalog unit.",
                INVALID_CONVERSION_FACTOR: "Faktor konversi harus bilangan bulat positif.",
                BASE_UNIT_DIMENSION_MISMATCH: "Unit dasar tidak sesuai dengan dimensi barang.",
                CONVERSION_DEFINITION_REQUIRED: "Definisi konversi wajib diisi untuk unit berbeda.",
                CONVERSION_REQUIRED: "Definisi isi kemasan belum lengkap.",
                CONVERSION_OVERFLOW: "Hasil konversi terlalu besar.",
                CAMP_NOT_ACTIVE: "Posko sudah ditutup sehingga tidak dapat memperbarui logistik.",
                P2034_EXHAUSTED: SERIALIZATION_CONFLICT_MESSAGE,
            };
            if (unitMessages[error.message]) return NextResponse.json({ success: false, message: unitMessages[error.message] }, { status: 400 });
        }
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("UPDATE_LOGISTICS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal memperbarui data logistik." },
            { status: 500 },
        );
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

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "LOGISTICS", item.campId)) {
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
        if (isAuthError(error)) {
            return authError(error);
        }
        if (isForeignKeyError(error)) {
            return NextResponse.json(
                { success: false, message: "Item terhubung dengan data lain sehingga tidak dapat dihapus." },
                { status: 409 },
            );
        }

        console.error("DELETE_LOGISTICS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus data logistik." },
            { status: 500 },
        );
    }
}
