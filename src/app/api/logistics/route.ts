import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { receiveStockInTx, runSerializable } from "@/lib/inventory";
import { writeAuditLog } from "@/lib/audit";
import { canManageDivision } from "@/lib/auth/guard";
import { assertCampActive, campError } from "@/lib/camps";
import { isSerializationConflict, SERIALIZATION_CONFLICT_MESSAGE } from "@/lib/prisma-errors";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, validateOptionalText, validateText } from "@/lib/validation";
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
        CONVERSION_REQUIRED: "Isi kemasan belum didefinisikan. Lengkapi faktor konversi terlebih dahulu.",
        CONVERSION_OVERFLOW: "Hasil konversi terlalu besar.",
        INVALID_QUANTITY: "Jumlah harus bilangan bulat lebih dari 0.",
        CAMP_NOT_ACTIVE: "Posko sudah ditutup sehingga tidak dapat menerima data logistik baru.",
        P2034_EXHAUSTED: SERIALIZATION_CONFLICT_MESSAGE,
    };
    return messages[error.message] ?? null;
}

export async function GET(request: Request) {
    try {
        const user = await requireAuth();

        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "LOGISTICS", user.campId))) {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke divisi logistik posko ini." }, { status: 403 });
        }
        const url = new URL(request.url);
        const params = parsePagination(url, 50, 100);
        const skip = (params.page! - 1) * params.limit!;
        const q = url.searchParams.get("q")?.trim();
        const status = url.searchParams.get("status")?.trim().toUpperCase();

        const baseWhere = user.role === "SUPER_ADMIN" ? {} : { campId: user.campId! };
        const where: Prisma.LogisticsItemWhereInput = {
            ...baseWhere,
            ...(q ? { itemName: { contains: q, mode: "insensitive" } } : {}),
            ...(status && ["SUFFICIENT", "LOW", "CRITICAL", "SPOILED_OR_DAMAGED"].includes(status) ? { status: status as "SUFFICIENT" | "LOW" | "CRITICAL" | "SPOILED_OR_DAMAGED" } : {}),
        };

        const [items, total] = await Promise.all([
            prisma.logisticsItem.findMany({
                where,
                skip,
                take: params.limit,
                orderBy: { updatedAt: "desc" },
                include: {
                    camp: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            prisma.logisticsItem.count({ where }),
        ]);

        return paginatedResponse(items, total, params);
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

        const body = await readJson(request);

        const campId =
            user.role === "SUPER_ADMIN"
                ? (typeof body.campId === "string" ? body.campId : "")
                : (user.campId ?? "");

        if (!campId) {
            return NextResponse.json({ success: false, message: "Posko wajib dipilih." }, { status: 400 });
        }

        const nameError = validateText(body.itemName, "Nama barang", MAX_NAME_LENGTH);
        if (nameError) return NextResponse.json({ success: false, message: nameError }, { status: 400 });

        if (body.quantity === undefined || !body.unit) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Jumlah dan satuan barang wajib diisi.",
                },
                { status: 400 },
            );
        }

        const notesError = validateOptionalText(body.notes, "Catatan", MAX_NOTE_LENGTH);
        if (notesError) return NextResponse.json({ success: false, message: notesError }, { status: 400 });

        const reasonError = validateOptionalText(body.reason, "Alasan stok awal", MAX_NOTE_LENGTH);
        if (reasonError) return NextResponse.json({ success: false, message: reasonError }, { status: 400 });

        const quantity = Number(body.quantity);
        const minimumQuantity = Number(body.minimumQuantity ?? 0);
        if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(minimumQuantity) || minimumQuantity < 0) {
            return NextResponse.json({ success: false, message: "Jumlah dan batas minimum harus bilangan bulat tidak negatif." }, { status: 400 });
        }
        const unitDefinition = parseUnitMetadata(body);
        const minimumQuantityBase = minimumQuantity === 0 ? 0 : convertToBase(minimumQuantity, unitDefinition);

        await assertCampActive(campId);

        // Create item + stok awal dalam satu transaksi Serializable
        // agar tidak meninggalkan item yatim bila mutasi stok awal gagal (mis. konversi).
        const result = await runSerializable(async (tx) => {
            const item = await tx.logisticsItem.create({
                data: {
                    campId,
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

            if (quantity > 0) {
                return receiveStockInTx(tx, {
                    logisticsItemId: item.id,
                    quantity,
                    createdById: user.id,
                    reason: typeof body.reason === "string" ? body.reason : "Stok awal dicatat",
                });
            }
            return item;
        });

        await writeAuditLog({
            userId: user.id,
            action: "CREATE",
            entity: "LogisticsItem",
            entityId: result.id,
            details: { campId: result.campId, itemName: result.itemName, unit: result.unit, initialQuantity: quantity },
        });

        return NextResponse.json(
            {
                success: true,
                message: "Data logistik berhasil dibuat.",
                data: result,
            },
            { status: 201 },
        );
    } catch (error) {
        if (isInvalidJson(error)) return invalidJsonResponse();
        if (isSerializationConflict(error)) return NextResponse.json({ success: false, message: SERIALIZATION_CONFLICT_MESSAGE }, { status: 409 });
        if (isAuthError(error)) return authError(error);
        const knownCampError = campError(error);
        if (knownCampError) return NextResponse.json({ success: false, message: knownCampError.message }, { status: knownCampError.status });
        const knownUnitError = unitError(error);
        if (knownUnitError) return NextResponse.json({ success: false, message: knownUnitError }, { status: 400 });

        console.error("CREATE_LOGISTICS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal membuat data logistik." },
            { status: 500 },
        );
    }
}
