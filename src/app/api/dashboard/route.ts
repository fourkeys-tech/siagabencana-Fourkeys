import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, getAccessibleCampWhere, isAuthError, requireAuth } from "@/lib/auth/guard";

export async function GET() {
    try {
        const user = await requireAuth();

        const campWhere = getAccessibleCampWhere(user);

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

        const distributionRecords = campIds.length === 0
            ? []
            : await prisma.distribution.findMany({
                where: {
                    status: { in: ["RESERVED", "SHIPPED", "RECEIVED"] },
                    OR: [
                        { sourceCampId: { in: campIds } },
                        { destinationCampId: { in: campIds } },
                    ],
                },
                orderBy: { updatedAt: "desc" },
                take: 50,
                select: {
                    id: true,
                    itemName: true,
                    quantity: true,
                    unit: true,
                    baseQuantity: true,
                    baseUnit: true,
                    conversionStatus: true,
                    status: true,
                    updatedAt: true,
                    sourceCamp: { select: { id: true, name: true } },
                    destinationCamp: { select: { id: true, name: true } },
                },
            });

        const preparedDistributions = distributionRecords
            .filter((distribution) => distribution.status === "RESERVED")
            .slice(0, 10);
        const shippedDistributions = distributionRecords
            .filter((distribution) => distribution.status === "SHIPPED" || distribution.status === "RECEIVED")
            .slice(0, 10);

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
                    preparedDistributions,
                    shippedDistributions,
                },
                camps,
            },
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
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