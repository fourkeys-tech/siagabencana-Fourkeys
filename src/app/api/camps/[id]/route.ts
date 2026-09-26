import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guard";

type Params = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        const { id } = await params;

        const camp = await prisma.camp.findUnique({
            where: { id },
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
        await requireRole("SUPER_ADMIN");

        const { id } = await params;
        const body = await request.json();

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

        const camp = await prisma.camp.update({
            where: { id },
            data: {
                ...(body.name !== undefined && {
                    name: String(body.name).trim(),
                }),
                ...(body.address !== undefined && {
                    address: String(body.address).trim(),
                }),
                ...(body.latitude !== undefined && {
                    latitude: Number(body.latitude),
                }),
                ...(body.longitude !== undefined && {
                    longitude: Number(body.longitude),
                }),
                ...(body.maxCapacity !== undefined && {
                    maxCapacity: Number(body.maxCapacity),
                }),
                ...(body.status !== undefined && {
                    status: body.status,
                }),
            },
        });

        return NextResponse.json({
            success: true,
            message: "Posko berhasil diperbarui.",
            data: camp,
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "UNAUTHORIZED") {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Unauthorized",
                    },
                    { status: 401 },
                );
            }

            if (error.message === "FORBIDDEN") {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Hanya Super Admin yang dapat mengubah posko.",
                    },
                    { status: 403 },
                );
            }
        }

        console.error("UPDATE_CAMP_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal memperbarui posko.",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: Request,
    { params }: Params,
) {
    try {
        await requireRole("SUPER_ADMIN");

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

        await prisma.camp.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Posko berhasil dihapus.",
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "UNAUTHORIZED") {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Unauthorized",
                    },
                    { status: 401 },
                );
            }

            if (error.message === "FORBIDDEN") {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Hanya Super Admin yang dapat menghapus posko.",
                    },
                    { status: 403 },
                );
            }
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