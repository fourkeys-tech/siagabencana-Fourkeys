import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";

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

        if (
            user.role !== "SUPER_ADMIN" &&
            user.campId !== item.campId
        ) {
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

        if (
            user.role !== "SUPER_ADMIN" &&
            (user.campId !== item.campId ||
                user.division !== "LOGISTICS")
        ) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        const body = await request.json();

        const updated = await prisma.logisticsItem.update({
            where: { id },
            data: {
                ...(body.itemName !== undefined && {
                    itemName: String(body.itemName).trim(),
                }),
                ...(body.quantity !== undefined && {
                    quantity: Number(body.quantity),
                }),
                ...(body.unit !== undefined && {
                    unit: String(body.unit).trim(),
                }),
                ...(body.status !== undefined && {
                    status: body.status,
                }),
                ...(body.notes !== undefined && {
                    notes: body.notes
                        ? String(body.notes).trim()
                        : null,
                }),
            },
        });

        return NextResponse.json({
            success: true,
            message: "Data logistik berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
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

        if (
            user.role !== "SUPER_ADMIN" &&
            (user.campId !== item.campId ||
                user.division !== "LOGISTICS")
        ) {
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
        console.error("DELETE_LOGISTICS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus data logistik." },
            { status: 500 },
        );
    }
}