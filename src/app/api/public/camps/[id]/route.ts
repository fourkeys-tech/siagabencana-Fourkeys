import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: Request,
    { params }: Params,
) {
    try {
        const { id } = await params;

        const camp = await prisma.camp.findFirst({
            where: {
                id,
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
            data: {
                ...camp,
                availableCapacity:
                    camp.maxCapacity -
                    camp.currentOccupants,
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
            },
        });
    } catch (error) {
        console.error("PUBLIC_CAMP_DETAIL_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data posko.",
            },
            { status: 500 },
        );
    }
}