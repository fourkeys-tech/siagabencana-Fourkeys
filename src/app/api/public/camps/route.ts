import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const camps = await prisma.camp.findMany({
            where: {
                status: "ACTIVE",
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
            orderBy: {
                name: "asc",
            },
        });

        const data = camps.map((camp) => ({
            ...camp,
            availableCapacity:
                camp.maxCapacity - camp.currentOccupants,
            occupancyPercentage:
                camp.maxCapacity > 0
                    ? Number(
                        (
                            (camp.currentOccupants /
                                camp.maxCapacity) *
                            100
                        ).toFixed(2),
                    )
                    : 0,
        }));

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("PUBLIC_CAMPS_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data posko.",
            },
            { status: 500 },
        );
    }
}