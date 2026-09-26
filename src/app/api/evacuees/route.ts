import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
    try {
        const user = await requireAuth();

        const evacuees = await prisma.evacueeRecord.findMany({
            where:
                user.role === "SUPER_ADMIN"
                    ? {}
                    : { campId: user.campId! },
            orderBy: { arrivedAt: "desc" },
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
            data: evacuees,
        });
    } catch (error) {
        console.error("GET_EVACUEES_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data pengungsi." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth();

        if (
            user.role !== "SUPER_ADMIN" &&
            (user.division !== "DATA_REGISTRATION" || !user.campId)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tidak memiliki akses registrasi.",
                },
                { status: 403 },
            );
        }

        const body = await request.json();

        const campId =
            user.role === "SUPER_ADMIN"
                ? body.campId
                : user.campId;

        const totalFamily = Number(body.totalFamily ?? 1);

        if (!campId || !body.name || totalFamily < 1) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "campId, name, dan totalFamily yang valid wajib diisi.",
                },
                { status: 400 },
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const camp = await tx.camp.findUnique({
                where: { id: campId },
            });

            if (!camp) {
                throw new Error("CAMP_NOT_FOUND");
            }

            if (
                camp.currentOccupants + totalFamily >
                camp.maxCapacity
            ) {
                throw new Error("CAMP_FULL");
            }

            const evacuee = await tx.evacueeRecord.create({
                data: {
                    campId,
                    name: String(body.name).trim(),
                    totalFamily,
                    hasSpecialNeeds: Boolean(
                        body.hasSpecialNeeds ?? false,
                    ),
                    notes: body.notes
                        ? String(body.notes).trim()
                        : null,
                },
            });

            await tx.camp.update({
                where: { id: campId },
                data: {
                    currentOccupants: {
                        increment: totalFamily,
                    },
                },
            });

            return evacuee;
        });

        return NextResponse.json(
            {
                success: true,
                message: "Pengungsi berhasil diregistrasikan.",
                data: result,
            },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "CAMP_NOT_FOUND") {
                return NextResponse.json(
                    { success: false, message: "Camp tidak ditemukan." },
                    { status: 404 },
                );
            }

            if (error.message === "CAMP_FULL") {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Kapasitas camp sudah tidak mencukupi.",
                    },
                    { status: 409 },
                );
            }
        }

        console.error("CREATE_EVACUEE_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal registrasi pengungsi." },
            { status: 500 },
        );
    }
}