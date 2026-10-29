import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";

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

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "DATA_REGISTRATION", existing.campId)) {
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
            const camp = await tx.camp.findUnique({
                where: { id: existing.campId },
                select: { currentOccupants: true },
            });

            if (!camp || camp.currentOccupants < existing.totalFamily) {
                throw new Error("INVALID_CAMP_OCCUPANCY");
            }

            // Kunci bersyarat: check-out ganda bersamaan tidak boleh mengurangi okupansi dua kali.
            const locked = await tx.evacueeRecord.updateMany({
                where: { id, departedAt: null },
                data: {
                    departedAt: new Date(),
                },
            });
            if (locked.count !== 1) throw new Error("ALREADY_CHECKED_OUT");
            const evacuee = await tx.evacueeRecord.findUniqueOrThrow({ where: { id } });

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

        await writeAuditLog({ userId: user.id, action: "CHECKOUT", entity: "EvacueeRecord", entityId: id, details: { campId: existing.campId, totalFamily: existing.totalFamily } });

        return NextResponse.json({
            success: true,
            message: "Pengungsi berhasil check-out.",
            data: result,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "ALREADY_CHECKED_OUT") {
            return NextResponse.json({ success: false, message: "Pengungsi sudah check-out." }, { status: 409 });
        }
        if (error instanceof Error && error.message === "INVALID_CAMP_OCCUPANCY") {
            return NextResponse.json(
                { success: false, message: "Jumlah pengungsi saat ini di posko tidak mencukupi untuk check-out ini." },
                { status: 409 },
            );
        }

        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("CHECKOUT_EVACUEE_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal melakukan check-out." },
            { status: 500 },
        );
    }
}