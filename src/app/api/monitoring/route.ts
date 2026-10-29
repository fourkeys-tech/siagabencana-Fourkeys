import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, getAccessibleCampWhere, isAuthError, requireAuth } from "@/lib/auth/guard";
import {
    CRITICAL_LOGISTICS_STATUSES,
    DAMAGED_FACILITY_STATUSES,
    NEAR_FULL_OCCUPANCY_PERCENTAGE,
    PROBLEM_FACILITY_STATUSES,
    PROBLEM_LOGISTICS_STATUSES,
} from "@/lib/status-groups";

type Warning = {
    type: "OCCUPANCY" | "LOGISTICS" | "FACILITY";
    campId: string;
    campName: string;
    message: string;
    count: number;
};

export async function GET() {
    try {
        const user = await requireAuth();

        const where = getAccessibleCampWhere(user);

        const camps = await prisma.camp.findMany({
            where,
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                maxCapacity: true,
                currentOccupants: true,
                status: true,
                logistics: {
                    select: { status: true },
                },
                facilities: {
                    select: { status: true },
                },
                _count: {
                    select: {
                        evacuees: { where: { departedAt: null } },
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        const occupancyWarnings: Warning[] = [];
        const logisticsWarnings: Warning[] = [];
        const facilityWarnings: Warning[] = [];

        const data = camps.map((camp) => {
            const problemLogistics = camp.logistics.filter((item) =>
                PROBLEM_LOGISTICS_STATUSES.includes(item.status),
            );

            const criticalLogistics = camp.logistics.filter((item) =>
                CRITICAL_LOGISTICS_STATUSES.includes(item.status),
            ).length;

            const problemFacilities = camp.facilities.filter((facility) =>
                PROBLEM_FACILITY_STATUSES.includes(facility.status),
            );

            const damagedFacilities = camp.facilities.filter((facility) =>
                DAMAGED_FACILITY_STATUSES.includes(facility.status),
            ).length;

            const occupancyPercentage =
                camp.maxCapacity > 0
                    ? Number(
                          (
                              (camp.currentOccupants /
                                  camp.maxCapacity) *
                              100
                          ).toFixed(2),
                      )
                    : 0;

            if (camp.status === "ACTIVE") {
                if (occupancyPercentage >= NEAR_FULL_OCCUPANCY_PERCENTAGE) {
                    occupancyWarnings.push({
                        type: "OCCUPANCY",
                        campId: camp.id,
                        campName: camp.name,
                        message: `${camp.name} hampir penuh (${Math.floor(occupancyPercentage)}% dari kapasitas)`,
                        count: 1,
                    });
                }

                if (criticalLogistics > 0) {
                    logisticsWarnings.push({
                        type: "LOGISTICS",
                        campId: camp.id,
                        campName: camp.name,
                        message: `Stok logistik kritis di ${camp.name} (${criticalLogistics} item)`,
                        count: criticalLogistics,
                    });
                }

                if (damagedFacilities > 0) {
                    facilityWarnings.push({
                        type: "FACILITY",
                        campId: camp.id,
                        campName: camp.name,
                        message: `Fasilitas rusak di ${camp.name} (${damagedFacilities} fasilitas)`,
                        count: damagedFacilities,
                    });
                }
            }

            return {
                id: camp.id,
                name: camp.name,
                address: camp.address,
                latitude: camp.latitude,
                longitude: camp.longitude,
                status: camp.status,
                maxCapacity: camp.maxCapacity,
                currentOccupants: camp.currentOccupants,
                availableCapacity: Math.max(
                    camp.maxCapacity - camp.currentOccupants,
                    0,
                ),
                occupancyPercentage,
                activeEvacuees: camp._count.evacuees,
                logisticsTotal: camp.logistics.length,
                problemLogistics: problemLogistics.length,
                criticalLogistics,
                problemFacilities: problemFacilities.length,
                damagedFacilities,
            };
        });

        const warnings = [
            ...occupancyWarnings,
            ...logisticsWarnings,
            ...facilityWarnings,
        ];

        const activeCamps = data.filter(
            (camp) => camp.status === "ACTIVE",
        );

        const totalCapacity = data.reduce(
            (sum, camp) => sum + camp.maxCapacity,
            0,
        );

        const totalOccupants = data.reduce(
            (sum, camp) => sum + camp.currentOccupants,
            0,
        );

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    activeCamps: activeCamps.length,
                    totalCamps: data.length,
                    totalCapacity,
                    totalOccupants,
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
                    criticalLogistics: data.reduce(
                        (sum, camp) => sum + camp.problemLogistics,
                        0,
                    ),
                    damagedFacilities: data.reduce(
                        (sum, camp) => sum + camp.problemFacilities,
                        0,
                    ),
                    warningCount: warnings.length,
                },
                warnings,
                camps: data,
            },
        });
    } catch (error) {
        if (isAuthError(error)) {
            return authError(error);
        }

        console.error("MONITORING_ERROR", error);

        return NextResponse.json(
            {
                success: false,
                message: "Gagal mengambil data monitoring.",
            },
            { status: 500 },
        );
    }
}
