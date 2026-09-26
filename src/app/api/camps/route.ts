import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guard";

export async function GET() {
    try {
        const camps = await prisma.camp.findMany({
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                maxCapacity: true,
                currentOccupants: true,
                status: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: camps,
        });
    } catch (error) {
        console.error("GET_CAMPS_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data posko.",
            },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        await requireRole("SUPER_ADMIN");

        const body = await request.json();

        const {
            name,
            address,
            latitude,
            longitude,
            maxCapacity,
        } = body;

        if (
            !name ||
            !address ||
            latitude === undefined ||
            longitude === undefined ||
            maxCapacity === undefined
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Semua field wajib diisi.",
                },
                { status: 400 },
            );
        }

        if (Number(maxCapacity) <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Kapasitas harus lebih dari 0.",
                },
                { status: 400 },
            );
        }

        const camp = await prisma.camp.create({
            data: {
                name: String(name).trim(),
                address: String(address).trim(),
                latitude: Number(latitude),
                longitude: Number(longitude),
                maxCapacity: Number(maxCapacity),
            },
        });

        return NextResponse.json(
            {
                success: true,
                message: "Posko berhasil dibuat.",
                data: camp,
            },
            { status: 201 },
        );
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
                        message: "Hanya Super Admin yang dapat membuat posko.",
                    },
                    { status: 403 },
                );
            }
        }

        console.error("CREATE_CAMP_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal membuat posko.",
            },
            { status: 500 },
        );
    }
}