import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";

type Params = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const evacuee = await prisma.evacueeRecord.findUnique({
            where: { id },
            include: {
                camp: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!evacuee) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data pengungsi tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "DATA_REGISTRATION", evacuee.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        return NextResponse.json({
            success: true,
            data: evacuee,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_EVACUEE_ERROR", error);

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

        const existing = await prisma.evacueeRecord.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data pengungsi tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "DATA_REGISTRATION", existing.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        const body = await request.json();

        const updated = await prisma.evacueeRecord.update({
            where: { id },
            data: {
                ...(body.name !== undefined && {
                    name: String(body.name).trim(),
                }),
                ...(body.hasSpecialNeeds !== undefined && {
                    hasSpecialNeeds: Boolean(body.hasSpecialNeeds),
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
            message: "Data pengungsi berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("UPDATE_EVACUEE_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal memperbarui data." },
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

        const existing = await prisma.evacueeRecord.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Data pengungsi tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "DATA_REGISTRATION", existing.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        await prisma.$transaction(async (tx) => {
            await tx.evacueeRecord.delete({
                where: { id },
            });

            if (!existing.departedAt) {
                await tx.camp.update({
                    where: { id: existing.campId },
                    data: {
                        currentOccupants: {
                            decrement: existing.totalFamily,
                        },
                    },
                });
            }
        });

        return NextResponse.json({
            success: true,
            message: "Data pengungsi berhasil dihapus.",
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("DELETE_EVACUEE_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus data." },
            { status: 500 },
        );
    }
}