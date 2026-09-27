import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { receiveStock } from "@/lib/inventory";
import { canManageDivision } from "@/lib/auth/guard";

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

        const body = await request.json();

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

        const camp = await prisma.camp.findUnique({
            where: { id: campId },
        });

        if (!camp) {
            return NextResponse.json(
                { success: false, message: "Camp tidak ditemukan." },
                { status: 404 },
            );
        }

        const item = await prisma.logisticsItem.create({
            data: {
                campId,
                itemName: String(body.itemName).trim(),
                quantity: 0,
                unit: String(body.unit).trim(),
                minimumQuantity: Number(body.minimumQuantity ?? 0),
                notes: body.notes ? String(body.notes).trim() : null,
            },
        });

        const result = Number(body.quantity) > 0
            ? await receiveStock({
                logisticsItemId: item.id,
                quantity: Number(body.quantity),
                createdById: user.id,
                reason: body.reason ?? "Stok awal dicatat",
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

        console.error("CREATE_LOGISTICS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal membuat data logistik." },
            { status: 500 },
        );
    }
}