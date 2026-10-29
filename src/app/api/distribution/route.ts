import { NextResponse } from "next/server";
import type { DistributionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { canManageRequest, hasDistributionAccess, isPositiveInteger } from "@/lib/distribution";
import { writeAuditLog } from "@/lib/audit";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { MAX_NOTE_LENGTH, validateOptionalText } from "@/lib/validation";
import { convertRequestedToStock, convertToBase, normalizeUnit, type UnitDefinition } from "@/lib/unit-conversion";

export async function GET(request: Request) {
    try {
        const user = await requireAuth();

        if (!hasDistributionAccess(user)) {
            return NextResponse.json(
                { success: false, message: "Fitur distribusi hanya tersedia untuk divisi logistik." },
                { status: 403 },
            );
        }

        const url = new URL(request.url);
        const statusParam = url.searchParams.get("status")?.trim().toUpperCase();

        const campFilter =
            user.role === "SUPER_ADMIN"
                ? (statusParam ? { status: statusParam as DistributionStatus } : undefined)
                : {
                      AND: [
                          {
                              OR: [
                                  { sourceCampId: user.campId ?? "" },
                                  { destinationCampId: user.campId ?? "" },
                              ],
                          },
                          ...(statusParam ? [{ status: statusParam as DistributionStatus }] : []),
                      ],
                  };

        const distributionFilter =
            user.role === "SUPER_ADMIN"
                ? (statusParam ? { status: statusParam as DistributionStatus } : undefined)
                : {
                      AND: [
                          {
                              OR: [
                                  { sourceCampId: user.campId ?? "" },
                                  { destinationCampId: user.campId ?? "" },
                              ],
                          },
                          ...(statusParam ? [{ status: statusParam as DistributionStatus }] : []),
                      ],
                  };

        const [requests, distributionRows, proofRows, sourceStockRows] = await Promise.all([
            prisma.logisticsRequest.findMany({
                where: campFilter,
                orderBy: { updatedAt: "desc" },
                include: {
                    sourceCamp: { select: { id: true, name: true } },
                    destinationCamp: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                    reviewedBy: { select: { id: true, name: true } },
                    distribution: {
                        select: {
                            id: true,
                            status: true,
                            shippedAt: true,
                            receivedAt: true,
                        },
                    },
                },
            }),
            prisma.distribution.findMany({
                where: distributionFilter,
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    requestId: true,
                    sourceCampId: true,
                    destinationCampId: true,
                    sourceItemId: true,
                    createdById: true,
                    itemName: true,
                    quantity: true,
                    unit: true,
                    notes: true,
                    status: true,
                    shippedAt: true,
                    receivedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    sourceCamp: { select: { id: true, name: true } },
                    destinationCamp: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                    requestedQuantity: true,
                    requestedUnit: true,
                    baseQuantity: true,
                    baseUnit: true,
                    unitDimension: true,
                    conversionFactor: true,
                    conversionStatus: true,
                    request: { select: { id: true, status: true } },
                },
            }),
            prisma.distribution.findMany({
                where: { ...distributionFilter, receiptProofData: { not: null } },
                select: { id: true, receiptProofMimeType: true },
            }),
            prisma.logisticsItem.findMany({
                where: {
                    camp: { status: "ACTIVE" },
                    status: { not: "SPOILED_OR_DAMAGED" },
                    damagedQuantity: { equals: 0 },
                    damagedQuantityBase: { equals: 0 },
                    quantityBase: { gt: 0 },
                },
                orderBy: [{ campId: "asc" }, { itemName: "asc" }],
                select: {
                    id: true,
                    campId: true,
                    itemName: true,
                    quantity: true,
                    reservedQuantity: true,
                    unit: true,
                    baseUnit: true,
                    unitDimension: true,
                    conversionFactor: true,
                    conversionStatus: true,
                    quantityBase: true,
                    reservedQuantityBase: true,
                },
            }),
        ]);

        const proofByDistributionId = new Map(
            proofRows.map((proof) => [proof.id, proof]),
        );
        const distributions = distributionRows.map((distribution) => {
            const proof = proofByDistributionId.get(distribution.id);
            return {
                ...distribution,
                receiptProofAvailable: Boolean(proof),
                receiptProofMimeType: proof?.receiptProofMimeType ?? null,
            };
        });

        // Stok lintas posko diperlukan untuk memilih sumber, tetapi hanya saldo tersedia yang dikirim.
        const sourceStocks = sourceStockRows
            .map(({ quantity, reservedQuantity, quantityBase, reservedQuantityBase, ...stock }) => ({
                ...stock,
                availableQuantity: Math.max(quantity - reservedQuantity, 0),
                availableBaseQuantity: Math.max(quantityBase - reservedQuantityBase, 0),
            }))
            .filter((stock) => stock.availableBaseQuantity > 0);

        return NextResponse.json({
            success: true,
            data: { requests, distributions, sourceStocks },
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_DISTRIBUTION_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data distribusi.",
            },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth();

        if (!hasDistributionAccess(user)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Hanya Manager posko, Super Admin, atau tim logistik yang dapat membuat permintaan.",
                },
                { status: 403 },
            );
        }

        const body = await readJson(request);

        const notesError = validateOptionalText(body.notes, "Catatan", MAX_NOTE_LENGTH);
        if (notesError) return NextResponse.json({ success: false, message: notesError }, { status: 400 });

        const sourceCampId = String(body.sourceCampId ?? "").trim();
        const requestedDestinationCampId = String(body.destinationCampId ?? "").trim();
        const destinationCampId = user.role === "SUPER_ADMIN" ? requestedDestinationCampId : user.campId;
        const sourceItemId = String(body.sourceItemId ?? "").trim();
        const requestedQuantity = Number(body.requestedQuantity ?? body.quantity);
        const requestedUnit = String(body.requestedUnit ?? "").trim();

        if (!sourceCampId || !destinationCampId || !sourceItemId || !isPositiveInteger(requestedQuantity) || !requestedUnit) {
            return NextResponse.json({ success: false, message: "Posko asal, posko tujuan, stok sumber, unit permintaan, dan jumlah wajib dipilih dengan benar." }, { status: 400 });
        }

        if (sourceCampId === destinationCampId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko asal dan tujuan harus berbeda.",
                },
                { status: 400 },
            );
        }

        if (!canManageRequest(user, sourceCampId, destinationCampId)) {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke rute distribusi ini." }, { status: 403 });
        }

        const camps = await prisma.camp.findMany({
            where: { id: { in: [sourceCampId, destinationCampId] } },
            select: { id: true, name: true, status: true },
        });

        if (
            camps.length !== 2 ||
            camps.some((camp) => camp.status !== "ACTIVE")
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko asal dan tujuan harus tersedia serta aktif.",
                },
                { status: 400 },
            );
        }

        const sourceItem = await prisma.logisticsItem.findUnique({
            where: { id: sourceItemId },
            select: {
                id: true,
                campId: true,
                itemName: true,
                unit: true,
                baseUnit: true,
                unitDimension: true,
                conversionFactor: true,
                conversionStatus: true,
                quantity: true,
                reservedQuantity: true,
                damagedQuantity: true,
                quantityBase: true,
                reservedQuantityBase: true,
                damagedQuantityBase: true,
                status: true,
            },
        });
        if (!sourceItem || sourceItem.campId !== sourceCampId) {
            return NextResponse.json({ success: false, message: "Stok sumber tidak cocok dengan posko asal." }, { status: 400 });
        }
        const definition: UnitDefinition = {
            unit: sourceItem.unit,
            baseUnit: sourceItem.baseUnit,
            unitDimension: sourceItem.unitDimension,
            conversionFactor: sourceItem.conversionFactor,
            conversionStatus: sourceItem.conversionStatus,
        };
        let quantity: number;
        let baseQuantity: number;
        try {
            quantity = convertRequestedToStock(requestedQuantity, requestedUnit, definition);
            baseQuantity = convertToBase(quantity, definition);
        } catch (conversionError) {
            const conversionMessages: Record<string, string> = {
                UNIT_CONVERSION_NOT_SUPPORTED: "Unit permintaan tidak memiliki definisi konversi yang aman.",
                CONVERSION_REQUIRED: "Isi kemasan belum didefinisikan. Lengkapi faktor konversi terlebih dahulu.",
                CONVERSION_NOT_EXACT: "Jumlah tidak dapat dikonversi tepat ke unit stok.",
                INVALID_CONVERSION_FACTOR: "Faktor konversi stok tidak valid.",
                CONVERSION_OVERFLOW: "Hasil konversi terlalu besar.",
                CONVERSION_DEFINITION_REQUIRED: "Definisi konversi wajib diisi untuk unit berbeda.",
                BASE_UNIT_DIMENSION_MISMATCH: "Unit dasar stok tidak sesuai dengan dimensi barang.",
                UNIT_REQUIRED: "Definisi unit stok tidak lengkap.",
                UNIT_NOT_SUPPORTED: "Unit tidak tersedia di katalog unit.",
            };
            const message = conversionError instanceof Error ? conversionMessages[conversionError.message] : null;
            return NextResponse.json({ success: false, message: message ?? "Konversi unit tidak valid." }, { status: 400 });
        }
        const availableQuantity = sourceItem.quantity - sourceItem.reservedQuantity;
        const availableBaseQuantity = sourceItem.quantityBase - sourceItem.reservedQuantityBase;
        if (sourceItem.status === "SPOILED_OR_DAMAGED" || sourceItem.damagedQuantity > 0 || sourceItem.damagedQuantityBase > 0 || sourceItem.quantityBase < 0 || sourceItem.reservedQuantityBase < 0 || availableQuantity < quantity || availableBaseQuantity < baseQuantity) {
            return NextResponse.json({ success: false, message: "Stok tersedia tidak mencukupi untuk permintaan ini." }, { status: 409 });
        }

        const logisticsRequest = await prisma.logisticsRequest.create({
            data: {
                sourceCampId,
                destinationCampId,
                createdById: user.id,
                itemName: sourceItem.itemName,
                quantity,
                unit: sourceItem.unit,
                requestedQuantity,
                requestedUnit: normalizeUnit(requestedUnit),
                baseQuantity,
                baseUnit: sourceItem.baseUnit,
                unitDimension: sourceItem.unitDimension,
                conversionFactor: sourceItem.conversionFactor,
                conversionStatus: sourceItem.conversionStatus,
                notes: body.notes ? String(body.notes).trim() : null,
            },
            include: {
                sourceCamp: { select: { id: true, name: true } },
                destinationCamp: { select: { id: true, name: true } },
            },
        });

        await writeAuditLog({ userId: user.id, action: "CREATE", entity: "LogisticsRequest", entityId: logisticsRequest.id, details: { itemName: logisticsRequest.itemName, quantity, unit: logisticsRequest.unit, sourceCampId, destinationCampId } });

        return NextResponse.json(
            {
                success: true,
                message: "Permintaan distribusi berhasil dibuat.",
                data: logisticsRequest,
            },
            { status: 201 },
        );
    } catch (error) {
        if (isInvalidJson(error)) return invalidJsonResponse();
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("CREATE_DISTRIBUTION_REQUEST_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal membuat permintaan distribusi.",
            },
            { status: 500 },
        );
    }
}

