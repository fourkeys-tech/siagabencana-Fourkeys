import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { assertUnitDefinition, convertToBase, defaultUnitDefinition, inferDimension, inferBaseUnit, normalizeUnit, type UnitConversionStatus, type UnitDimension } from "@/lib/unit-conversion";

type Params = {
    params: Promise<{ id: string }>;
};

async function getItem(id: string) {
    return prisma.logisticsItem.findUnique({
        where: { id },
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

        const body = await request.json() as Record<string, unknown>;
        const forbiddenFields = ["quantity", "status", "reservedQuantity", "damagedQuantity", "quantityBase", "reservedQuantityBase", "damagedQuantityBase"];
        if (forbiddenFields.some((field) => body[field] !== undefined)) {
            return NextResponse.json(
                { success: false, message: "Saldo stok dan status hanya dapat diubah melalui inventory movement." },
                { status: 400 },
            );
        }

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
        const updated = await prisma.$transaction(async (tx) => tx.logisticsItem.update({
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
        }));

        return NextResponse.json({
            success: true,
            message: "Data logistik berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
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

        await prisma.logisticsItem.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Data logistik berhasil dihapus.",
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("DELETE_LOGISTICS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus data logistik." },
            { status: 500 },
        );
    }
}