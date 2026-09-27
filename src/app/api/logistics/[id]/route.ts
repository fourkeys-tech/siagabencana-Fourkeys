import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";

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

        const body = await request.json();
        const forbiddenFields = ["quantity", "status", "reservedQuantity", "damagedQuantity"];
        if (forbiddenFields.some((field) => body[field] !== undefined)) {
            return NextResponse.json(
                { success: false, message: "Saldo stok dan status hanya dapat diubah melalui inventory movement." },
                { status: 400 },
            );
        }

        const updated = await prisma.logisticsItem.update({
            where: { id },
            data: {
                ...(body.itemName !== undefined && { itemName: String(body.itemName).trim() }),
                ...(body.unit !== undefined && { unit: String(body.unit).trim() }),
                ...(body.minimumQuantity !== undefined && { minimumQuantity: Number(body.minimumQuantity) }),
                ...(body.notes !== undefined && { notes: body.notes ? String(body.notes).trim() : null }),
            },
        });

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