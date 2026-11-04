import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageDivision, requireAuth } from "@/lib/auth/guard";
import { receiveStockInTx, runSerializable } from "@/lib/inventory";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/api-errors";
import { assertCampActive } from "@/lib/camps";
import { readJson } from "@/lib/http";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, validateOptionalText, validateText } from "@/lib/validation";
import { convertToBase, resolveUnitDefinition } from "@/lib/unit-conversion";

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
        return handleRouteError(error, { context: "GET_LOGISTICS_ERROR", fallback: "Gagal mengambil data logistik." });
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

        const conversionNoteError = validateOptionalText(body.conversionNote, "Catatan konversi", MAX_NOTE_LENGTH);
        if (conversionNoteError) return NextResponse.json({ success: false, message: conversionNoteError }, { status: 400 });

        const quantity = Number(body.quantity);
        const minimumQuantity = Number(body.minimumQuantity ?? 0);
        if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(minimumQuantity) || minimumQuantity < 0) {
            return NextResponse.json({ success: false, message: "Jumlah dan batas minimum harus bilangan bulat tidak negatif." }, { status: 400 });
        }
        // Status konversi selalu diturunkan dari unit + faktor, tidak diterima dari client.
        const unitDefinition = resolveUnitDefinition(body);
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
                    conversionNote: typeof body.conversionNote === "string" ? body.conversionNote.trim() || null : null,
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
        return handleRouteError(error, {
            context: "CREATE_LOGISTICS_ERROR",
            fallback: "Gagal membuat data logistik.",
            messages: { CAMP_NOT_ACTIVE: "Posko sudah ditutup sehingga tidak dapat menerima data logistik baru." },
        });
    }
}
