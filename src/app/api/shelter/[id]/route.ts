import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, isAuthError, requireAuth } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";

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

        const body = await request.json() as Record<string, unknown>;
        const action = String(body.action ?? "").toUpperCase();
        if (["START_REPAIR", "COMPLETE_REPAIR", "MARK_REPLACEMENT"].includes(action)) {
            const note = String(body.note ?? "").trim();
            if (!note) return NextResponse.json({ success: false, message: "Catatan tindakan wajib diisi." }, { status: 400 });
            const nextStatus = action === "START_REPAIR" ? "REPAIRING" : action === "COMPLETE_REPAIR" ? "GOOD" : "DAMAGED";
            const validTransition = (action === "START_REPAIR" && report.status === "DAMAGED") || (action === "COMPLETE_REPAIR" && report.status === "REPAIRING") || (action === "MARK_REPLACEMENT" && report.status !== "GOOD");
            if (!validTransition) return NextResponse.json({ success: false, message: "Transisi status fasilitas tidak sesuai alur." }, { status: 409 });
            const changed = await prisma.facilityReport.updateMany({
                where: { id, status: report.status },
                data: { status: nextStatus, description: `${report.description}\n\n[${action}] ${note}` },
            });
            if (changed.count !== 1) {
                return NextResponse.json({ success: false, message: "Status fasilitas sudah berubah. Muat ulang data lalu coba lagi." }, { status: 409 });
            }
            const updated = await prisma.facilityReport.findUniqueOrThrow({ where: { id } });
            await writeAuditLog({ userId: user.id, action: `FACILITY_${action}`, entity: "FacilityReport", entityId: id, details: { from: report.status, to: nextStatus, note } });
            return NextResponse.json({ success: true, message: "Tindakan fasilitas berhasil dicatat.", data: updated });
        }

        const allowedStatuses = new Set(["GOOD", "DAMAGED", "REPAIRING"]);
        const nextStatus = body.status === undefined ? report.status : String(body.status).toUpperCase();
        if (!allowedStatuses.has(nextStatus)) {
            return NextResponse.json(
                { success: false, message: "Status fasilitas tidak valid." },
                { status: 400 },
            );
        }
        if (body.status !== undefined && nextStatus !== report.status) {
            return NextResponse.json(
                { success: false, message: "Perubahan status harus memakai aksi perbaikan atau penggantian." },
                { status: 409 },
            );
        }

        const updated = await prisma.facilityReport.update({
            where: { id },
            data: {
                ...(body.facilityName !== undefined && {
                    facilityName: String(body.facilityName).trim(),
                }),
                ...(body.status !== undefined && {
                    status: nextStatus as "GOOD" | "DAMAGED" | "REPAIRING",
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