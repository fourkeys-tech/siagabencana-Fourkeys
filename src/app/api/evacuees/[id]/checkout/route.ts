import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";

type Params = {
    params: Promise<{ id: string }>;
};

export async function POST(
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

        if (
            user.role !== "SUPER_ADMIN" &&
            (user.campId !== existing.campId ||
                user.division !== "DATA_REGISTRATION")
        ) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        if (existing.departedAt) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Pengungsi sudah check-out.",
                },
                { status: 409 },
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const evacuee = await tx.evacueeRecord.update({
                where: { id },
                data: {
                    departedAt: new Date(),
                },
            });

            await tx.camp.update({
                where: { id: existing.campId },
                data: {
                    currentOccupants: {
                        decrement: existing.totalFamily,
                    },
                },
            });

            return evacuee;
        });

        return NextResponse.json({
            success: true,
            message: "Pengungsi berhasil check-out.",
            data: result,
        });
    } catch (error) {
        console.error("CHECKOUT_EVACUEE_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal melakukan check-out." },
            { status: 500 },
        );
    }
}