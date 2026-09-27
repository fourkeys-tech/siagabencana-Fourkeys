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

        const report = await prisma.facilityReport.findUnique({
            where: { id },
        });

        if (!report) {
            return NextResponse.json(
                { success: false, message: "Laporan tidak ditemukan." },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "SHELTER", report.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        return NextResponse.json({
            success: true,
            data: report,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_SHELTER_ITEM_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal mengambil laporan." },
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

        const report = await prisma.facilityReport.findUnique({
            where: { id },
        });

        if (!report) {
            return NextResponse.json(
                { success: false, message: "Laporan tidak ditemukan." },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "SHELTER", report.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        const body = await request.json();

        const updated = await prisma.facilityReport.update({
            where: { id },
            data: {
                ...(body.facilityName !== undefined && {
                    facilityName: String(body.facilityName).trim(),
                }),
                ...(body.status !== undefined && {
                    status: body.status,
                }),
                ...(body.description !== undefined && {
                    description: String(body.description).trim(),
                }),
            },
        });

        return NextResponse.json({
            success: true,
            message: "Laporan shelter berhasil diperbarui.",
            data: updated,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("UPDATE_SHELTER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal memperbarui laporan." },
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

        const report = await prisma.facilityReport.findUnique({
            where: { id },
        });

        if (!report) {
            return NextResponse.json(
                { success: false, message: "Laporan tidak ditemukan." },
                { status: 404 },
            );
        }

        if (user.role !== "SUPER_ADMIN" && !canManageDivision(user, "SHELTER", report.campId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        await prisma.facilityReport.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Laporan shelter berhasil dihapus.",
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("DELETE_SHELTER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Gagal menghapus laporan." },
            { status: 500 },
        );
    }
}