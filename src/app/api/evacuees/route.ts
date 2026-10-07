import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(request: Request) {
    try {
        const user = await requireAuth();
        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "DATA_REGISTRATION", user.campId))) {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke divisi registrasi posko ini." }, { status: 403 });
        }

        const params = parsePagination(new URL(request.url));
        const skip = (params.page! - 1) * params.limit!;
        const where = user.role === "SUPER_ADMIN" ? {} : { campId: user.campId! };

        const [evacuees, total] = await Promise.all([
            prisma.evacueeRecord.findMany({
                where,
                orderBy: { arrivedAt: "desc" },
                skip,
                take: params.limit,
                include: {
                    camp: { select: { id: true, name: true } },
                },
            }),
            prisma.evacueeRecord.count({ where }),
        ]);

        return paginatedResponse(evacuees, total, params);
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

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
            (!user.campId || !canManageDivision(user, "DATA_REGISTRATION", user.campId))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tidak memiliki akses registrasi.",
                },
                { status: 403 },
            );
        }

        const body = await request.json() as Record<string, unknown>;

        const campId =
            user.role === "SUPER_ADMIN"
                ? (typeof body.campId === "string" ? body.campId : "")
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
        if (isAuthError(error)) {
            return authError(error);
        }

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