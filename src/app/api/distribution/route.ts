import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { isPositiveInteger } from "@/lib/distribution";
import { canManageDivision } from "@/lib/auth/guard";

export async function GET() {
    try {
        const user = await requireAuth();

        if (user.role !== "SUPER_ADMIN" && (!user.campId || !canManageDivision(user, "LOGISTICS", user.campId))) {
            return NextResponse.json(
                { success: false, message: "Fitur distribusi hanya tersedia untuk divisi logistik." },
                { status: 403 },
            );
        }

        const campFilter =
            user.role === "SUPER_ADMIN"
                ? undefined
                : {
                      OR: [
                          { sourceCampId: user.campId ?? "" },
                          { destinationCampId: user.campId ?? "" },
                      ],
                  };

        const distributionFilter =
            user.role === "SUPER_ADMIN"
                ? undefined
                : {
                      OR: [
                          { sourceCampId: user.campId ?? "" },
                          { destinationCampId: user.campId ?? "" },
                      ],
                  };

        const [requests, distributions] = await Promise.all([
            prisma.logisticsRequest.findMany({
                where: campFilter,
                orderBy: { updatedAt: "desc" },
                include: {
                    sourceCamp: { select: { id: true, name: true } },
                    destinationCamp: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                    reviewedBy: { select: { id: true, name: true } },
                    distribution: {
                        select: {
                            id: true,
                            status: true,
                            shippedAt: true,
                            receivedAt: true,
                        },
                    },
                },
            }),
            prisma.distribution.findMany({
                where: distributionFilter,
                orderBy: { updatedAt: "desc" },
                include: {
                    sourceCamp: { select: { id: true, name: true } },
                    destinationCamp: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                    request: { select: { id: true, status: true } },
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: { requests, distributions },
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("GET_DISTRIBUTION_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data distribusi.",
            },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await requireAuth();

        if (
            user.role !== "SUPER_ADMIN" &&
            (!user.campId || !canManageDivision(user, "LOGISTICS", user.campId))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Hanya pengguna divisi logistik yang dapat membuat permintaan.",
                },
                { status: 403 },
            );
        }

        const body = await request.json();
        const sourceCampId = String(body.sourceCampId ?? "").trim();
        const requestedDestinationCampId = String(
            body.destinationCampId ?? "",
        ).trim();
        const destinationCampId =
            user.role === "SUPER_ADMIN"
                ? requestedDestinationCampId
                : user.campId;
        const itemName = String(body.itemName ?? "").trim();
        const unit = String(body.unit ?? "").trim();
        const quantity = Number(body.quantity);

        if (
            !sourceCampId ||
            !destinationCampId ||
            !itemName ||
            !unit ||
            !isPositiveInteger(quantity)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Posko asal, posko tujuan, nama barang, jumlah, dan unit wajib diisi dengan benar.",
                },
                { status: 400 },
            );
        }

        if (sourceCampId === destinationCampId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko asal dan tujuan harus berbeda.",
                },
                { status: 400 },
            );
        }

        const camps = await prisma.camp.findMany({
            where: { id: { in: [sourceCampId, destinationCampId] } },
            select: { id: true, name: true, status: true },
        });

        if (
            camps.length !== 2 ||
            camps.some((camp) => camp.status !== "ACTIVE")
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Posko asal dan tujuan harus tersedia serta aktif.",
                },
                { status: 400 },
            );
        }

        const logisticsRequest = await prisma.logisticsRequest.create({
            data: {
                sourceCampId,
                destinationCampId,
                createdById: user.id,
                itemName,
                quantity,
                unit,
                notes: body.notes ? String(body.notes).trim() : null,
            },
            include: {
                sourceCamp: { select: { id: true, name: true } },
                destinationCamp: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json(
            {
                success: true,
                message: "Permintaan distribusi berhasil dibuat.",
                data: logisticsRequest,
            },
            { status: 201 },
        );
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("CREATE_DISTRIBUTION_REQUEST_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal membuat permintaan distribusi.",
            },
            { status: 500 },
        );
    }
}

