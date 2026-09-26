import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
    try {
        const user = await requireAuth();

        const campWhere =
            user.role === "SUPER_ADMIN"
                ? {}
                : { id: user.campId! };

        const camps = await prisma.camp.findMany({
            where: campWhere,
            select: {
                id: true,
                name: true,
                maxCapacity: true,
                currentOccupants: true,
                status: true,
            },
            orderBy: {
                name: "asc",
            },
        });

        const campIds = camps.map((camp) => camp.id);

        const [
            staffCount,
            logisticsCount,
            criticalLogistics,
            damagedFacilities,
            specialNeeds,
            activeEvacuees,
        ] = await Promise.all([
            prisma.user.count({
                where: {
                    campId: {
                        in: campIds,
                    },
                },
            }),

            prisma.logisticsItem.count({
                where: {
                    campId: {
                        in: campIds,
                    },
                },
            }),

            prisma.logisticsItem.count({
                where: {
                    campId: {
                        in: campIds,
                    },
                    status: {
                        in: ["LOW", "CRITICAL", "SPOILED_OR_DAMAGED"],
                    },
                },
            }),

            prisma.facilityReport.count({
                where: {
                    campId: {
                        in: campIds,
                    },
                    status: {
                        in: ["DAMAGED", "REPAIRING"],
                    },
                },
            }),

            prisma.evacueeRecord.count({
                where: {
                    campId: {
                        in: campIds,
                    },
                    hasSpecialNeeds: true,
                    departedAt: null,
                },
            }),

            prisma.evacueeRecord.count({
                where: {
                    campId: {
                        in: campIds,
                    },
                    departedAt: null,
                },
            }),
        ]);

        const totalCapacity = camps.reduce(
            (sum, camp) => sum + camp.maxCapacity,
            0,
        );

        const totalOccupants = camps.reduce(
            (sum, camp) => sum + camp.currentOccupants,
            0,
        );

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalCamps: camps.length,
                    totalCapacity,
                    totalOccupants,
                    availableCapacity:
                        totalCapacity - totalOccupants,
                    occupancyPercentage:
                        totalCapacity > 0
                            ? Number(
                                (
                                    (totalOccupants /
                                        totalCapacity) *
                                    100
                                ).toFixed(2),
                            )
                            : 0,
                    staffCount,
                    logisticsCount,
                    criticalLogistics,
                    damagedFacilities,
                    specialNeeds,
                    activeEvacuees,
                },
                camps,
            },
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
        }

        console.error("DASHBOARD_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil dashboard.",
            },
            { status: 500 },
        );
    }
}