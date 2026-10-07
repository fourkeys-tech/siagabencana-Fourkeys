import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { receiveStock } from "@/lib/inventory";
import { canManageDivision } from "@/lib/auth/guard";
import { assertUnitDefinition, convertToBase, defaultUnitDefinition, inferDimension, inferBaseUnit, normalizeUnit, type UnitConversionStatus, type UnitDimension } from "@/lib/unit-conversion";

const UNIT_DIMENSIONS = new Set<UnitDimension>(["COUNT", "MASS", "VOLUME"]);

function parseUnitMetadata(body: Record<string, unknown>) {
    const unit = normalizeUnit(body.unit);
    const inferred = defaultUnitDefinition(unit);
    const baseUnit = normalizeUnit(body.baseUnit ?? inferred.baseUnit ?? inferBaseUnit(unit));
    const unitDimension = UNIT_DIMENSIONS.has(String(body.unitDimension) as UnitDimension)
        ? String(body.unitDimension) as UnitDimension
        : inferred.unitDimension ?? inferDimension(baseUnit);
    const conversionFactor = Number(body.conversionFactor ?? (body.baseUnit === undefined ? inferred.conversionFactor : 1));
    const conversionStatus: UnitConversionStatus = body.conversionStatus === "NEEDS_REVIEW"
        ? "NEEDS_REVIEW"
        : body.conversionStatus === "CONFIGURED"
            || (inferred.conversionStatus === "CONFIGURED" && baseUnit === inferred.baseUnit)
            || (unit === baseUnit && ["pcs", "unit", "g", "ml"].includes(baseUnit))
            || (unit !== baseUnit && body.conversionFactor !== undefined)
            ? "CONFIGURED"
            : "NEEDS_REVIEW";
    return assertUnitDefinition({ unit, baseUnit, unitDimension, conversionFactor, conversionStatus });
}

function unitError(error: unknown) {
    if (!(error instanceof Error)) return null;
    const messages: Record<string, string> = {
        UNIT_REQUIRED: "Unit dan unit dasar wajib diisi.",
        UNIT_NOT_SUPPORTED: "Unit tidak tersedia di katalog unit.",
        INVALID_CONVERSION_FACTOR: "Faktor konversi harus bilangan bulat positif.",
        BASE_UNIT_DIMENSION_MISMATCH: "Unit dasar tidak sesuai dengan dimensi barang.",
        CONVERSION_DEFINITION_REQUIRED: "Definisi konversi wajib diisi untuk unit berbeda.",
        CONVERSION_OVERFLOW: "Hasil konversi terlalu besar.",
        INVALID_QUANTITY: "Jumlah harus bilangan bulat lebih dari 0.",
    };
    return messages[error.message] ?? null;
}

export async function GET() {
    try {
        const user = await requireAuth();

        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "LOGISTICS", user.campId))) {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke divisi logistik posko ini." }, { status: 403 });
        }
        const where = user.role === "SUPER_ADMIN" ? {} : { campId: user.campId! };

        const items = await prisma.logisticsItem.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            include: {
                camp: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: items,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_LOGISTICS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data logistik." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth();

        if (
            user.role !== "SUPER_ADMIN" &&
            (!user.campId || !canManageDivision(user, "LOGISTICS", user.campId))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tidak memiliki akses ke divisi logistik.",
                },
                { status: 403 },
            );
        }

        const body = await request.json() as Record<string, unknown>;

        const campId =
            user.role === "SUPER_ADMIN"
                ? body.campId
                : user.campId;

        if (!campId || !body.itemName || body.quantity === undefined || !body.unit) {
            return NextResponse.json(
                {
                    success: false,
                    message: "campId, itemName, quantity, dan unit wajib diisi.",
                },
                { status: 400 },
            );
        }

        const quantity = Number(body.quantity);
        const minimumQuantity = Number(body.minimumQuantity ?? 0);
        if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(minimumQuantity) || minimumQuantity < 0) {
            return NextResponse.json({ success: false, message: "Jumlah dan batas minimum harus bilangan bulat tidak negatif." }, { status: 400 });
        }
        const unitDefinition = parseUnitMetadata(body);
        const minimumQuantityBase = minimumQuantity === 0 ? 0 : convertToBase(minimumQuantity, unitDefinition);

        const camp = await prisma.camp.findUnique({
            where: { id: String(campId) },
        });

        if (!camp || camp.status !== "ACTIVE") {
            return NextResponse.json({ success: false, message: "Camp tidak ditemukan atau tidak aktif." }, { status: 400 });
        }

        const item = await prisma.logisticsItem.create({
            data: {
                campId: String(campId),
                itemName: String(body.itemName).trim(),
                quantity: 0,
                reservedQuantity: 0,
                damagedQuantity: 0,
                unit: unitDefinition.unit,
                baseUnit: unitDefinition.baseUnit,
                unitDimension: unitDefinition.unitDimension,
                conversionFactor: unitDefinition.conversionFactor,
                conversionStatus: unitDefinition.conversionStatus,
                conversionNote: typeof body.conversionNote === "string" ? body.conversionNote.trim() : null,
                minimumQuantity,
                quantityBase: 0,
                reservedQuantityBase: 0,
                damagedQuantityBase: 0,
                minimumQuantityBase,
                status: quantity === 0 ? "CRITICAL" : "SUFFICIENT",
                notes: body.notes ? String(body.notes).trim() : null,
            },
        });

        const result = quantity > 0
            ? await receiveStock({
                logisticsItemId: item.id,
                quantity,
                createdById: user.id,
                reason: typeof body.reason === "string" ? body.reason : "Stok awal dicatat",
            })
            : item;

        return NextResponse.json(
            {
                success: true,
                message: "Data logistik berhasil dibuat.",
                data: result,
            },
            { status: 201 },
        );
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }
        const knownUnitError = unitError(error);
        if (knownUnitError) return NextResponse.json({ success: false, message: knownUnitError }, { status: 400 });

        console.error("CREATE_LOGISTICS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal membuat data logistik." },
            { status: 500 },
        );
    }
}