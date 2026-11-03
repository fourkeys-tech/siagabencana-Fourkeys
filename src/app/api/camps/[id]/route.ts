import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, getAccessibleCampWhere, isAuthError, requireAuth, requireRole } from "@/lib/auth/guard";
import { campValidationMessage, parseCampInput } from "@/lib/camp-validation";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/api-errors";
import { isForeignKeyError } from "@/lib/prisma-errors";
import { readJson } from "@/lib/http";
import { runSerializable } from "@/lib/transaction";

type Params = {
    params: Promise<{
        id: string;
    }>;
};

// Validasi input dilempar dari dalam transaksi; pesan user dibawa sampai ke catch.
class InvalidCampInput extends Error {
    constructor(readonly userMessage: string) {
        super("INVALID_CAMP_INPUT");
    }
}

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        const user = await requireAuth();

        const { id } = await params;

        const camp = await prisma.camp.findFirst({
            where: { AND: [{ id }, getAccessibleCampWhere(user)] },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                maxCapacity: true,
                currentOccupants: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!camp) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
            data: camp,
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_CAMP_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data posko.",
            },
            { status: 500 },
        );
    }
}

export async function PUT(
    request: Request,
    { params }: Params,
) {
    try {
        const currentUser = await requireRole("SUPER_ADMIN");

        const { id } = await params;
        const body = await readJson(request);

        // Semua cek (okupansi, kapasitas, distribusi berjalan) dibaca di transaksi yang sama dengan update:
        // registrasi pengungsi / reservasi distribusi paralel tidak bisa lolos di antara cek dan penutupan.
        const camp = await runSerializable(async (tx) => {
            const existingCamp = await tx.camp.findUnique({ where: { id } });
            if (!existingCamp) throw new Error("CAMP_NOT_FOUND");

            let campInput;
            try {
                campInput = parseCampInput({
                    name: body.name ?? existingCamp.name,
                    address: body.address ?? existingCamp.address,
                    latitude: body.latitude ?? existingCamp.latitude,
                    longitude: body.longitude ?? existingCamp.longitude,
                    maxCapacity: body.maxCapacity ?? existingCamp.maxCapacity,
                    status: body.status ?? existingCamp.status,
                }, existingCamp.currentOccupants);
            } catch (validationError) {
                throw new InvalidCampInput(campValidationMessage(validationError) ?? "Data posko tidak valid.");
            }

            // Posko hanya boleh ditutup jika sudah kosong dan tidak memiliki distribusi yang berjalan.
            if (campInput.status === "CLOSED" && existingCamp.status === "ACTIVE") {
                if (existingCamp.currentOccupants > 0) throw new Error("CAMP_HAS_ACTIVE_EVACUEES");
                const activeDistributions = await tx.distribution.count({
                    where: {
                        status: { in: ["RESERVED", "SHIPPED"] },
                        OR: [{ sourceCampId: id }, { destinationCampId: id }],
                    },
                });
                if (activeDistributions > 0) throw new Error("CAMP_HAS_ACTIVE_DISTRIBUTIONS");
            }

            return tx.camp.update({ where: { id }, data: campInput });
        });

		await writeAuditLog({ userId: currentUser.id, action: "UPDATE", entity: "Camp", entityId: id, details: { name: camp.name, status: camp.status, maxCapacity: camp.maxCapacity } });

        return NextResponse.json({
            success: true,
            message: "Posko berhasil diperbarui.",
            data: camp,
        });
    } catch (error) {
        if (error instanceof InvalidCampInput) return NextResponse.json({ success: false, message: error.userMessage }, { status: 400 });
        return handleRouteError(error, {
            context: "UPDATE_CAMP_ERROR",
            fallback: "Gagal memperbarui posko.",
            forbiddenMessage: "Hanya Super Admin yang dapat mengubah posko.",
        });
    }
}

export async function DELETE(
    _request: Request,
    { params }: Params,
) {
    try {
        const currentUser = await requireRole("SUPER_ADMIN");

        const { id } = await params;

        const existingCamp = await prisma.camp.findUnique({
            where: { id },
        });

        if (!existingCamp) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        const [movementCount, activeRequestCount, activeDistributionCount] = await Promise.all([
            prisma.inventoryMovement.count({ where: { campId: id } }),
            prisma.logisticsRequest.count({ where: { status: "PENDING", OR: [{ sourceCampId: id }, { destinationCampId: id }] } }),
            prisma.distribution.count({ where: { status: { in: ["RESERVED", "SHIPPED"] }, OR: [{ sourceCampId: id }, { destinationCampId: id }] } }),
        ]);

        if (movementCount > 0 || activeRequestCount > 0 || activeDistributionCount > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko memiliki riwayat stok atau distribusi berjalan. Tutup posko (status CLOSED) alih-alih menghapus.",
                },
                { status: 409 },
            );
        }

        await prisma.camp.delete({
            where: { id },
        });

        await writeAuditLog({ userId: currentUser.id, action: "DELETE", entity: "Camp", entityId: id, details: { name: existingCamp.name } });

        return NextResponse.json({
            success: true,
            message: "Posko berhasil dihapus.",
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(
                error,
                "Hanya Super Admin yang dapat menghapus posko.",
            );
        }

        if (isForeignKeyError(error)) {
            return NextResponse.json(
                { success: false, message: "Posko masih direferensikan data lain. Tutup posko alih-alih menghapus." },
                { status: 409 },
            );
        }

        console.error("DELETE_CAMP_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal menghapus posko.",
            },
            { status: 500 },
        );
    }
}