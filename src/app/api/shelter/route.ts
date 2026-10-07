import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";

export async function GET() {
    try {
        const user = await requireAuth();
        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "SHELTER", user.campId))) {
            return NextResponse.json({ success: false, message: "Tidak memiliki akses ke divisi shelter posko ini." }, { status: 403 });
        }

        const reports = await prisma.facilityReport.findMany({
            where:
                user.role === "SUPER_ADMIN"
                    ? {}
                    : { campId: user.campId! },
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
            data: reports,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_SHELTER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil data shelter." },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth();

        if (
            user.role !== "SUPER_ADMIN" &&
            (!user.campId || !canManageDivision(user, "SHELTER", user.campId))
        ) {
            return NextResponse.json(
                { success: false, message: "Tidak memiliki akses shelter." },
                { status: 403 },
            );
        }

        const body = await request.json() as Record<string, unknown>;

        const campId =
            user.role === "SUPER_ADMIN"
                ? (typeof body.campId === "string" ? body.campId : "")
                : user.campId;

        if (!campId || !body.facilityName || !body.description) {
            return NextResponse.json(
                {
                    success: false,
                    message: "campId, facilityName, dan description wajib diisi.",
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

        const status = String(body.status ?? "GOOD").toUpperCase();
        if (!["GOOD", "DAMAGED", "REPAIRING"].includes(status)) {
            return NextResponse.json(
                { success: false, message: "Status fasilitas tidak valid." },
                { status: 400 },
            );
        }

        const report = await prisma.facilityReport.create({
            data: {
                campId,
                facilityName: String(body.facilityName).trim(),
                status: status as "GOOD" | "DAMAGED" | "REPAIRING",
                description: String(body.description).trim(),
            },
        });

        return NextResponse.json(
            {
                success: true,
                message: "Laporan shelter berhasil dibuat.",
                data: report,
            },
            { status: 201 },
        );
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("CREATE_SHELTER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal membuat laporan shelter." },
            { status: 500 },
        );
    }
}