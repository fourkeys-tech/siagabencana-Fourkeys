import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, getAccessibleCampWhere, isAuthError, requireAuth } from "@/lib/auth/guard";
import { buildActionItems, getActionKeys, getDashboardScope, occupancyPercentage, sumStatusCounts } from "@/lib/dashboard";
import {
    CRITICAL_LOGISTICS_STATUSES,
    DAMAGED_FACILITY_STATUSES,
    NEAR_FULL_OCCUPANCY_PERCENTAGE,
    PROBLEM_FACILITY_STATUSES,
    PROBLEM_LOGISTICS_STATUSES,
} from "@/lib/status-groups";

const DISTRIBUTION_LIST_SIZE = 10;

const distributionSelect = {
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
} as const;

export async function GET() {
    try {
        const user = await requireAuth();
        const scope = getDashboardScope(user);
        const actionKeys = getActionKeys(user, scope);

        const camps = await prisma.camp.findMany({
            where: getAccessibleCampWhere(user),
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
        // Kapasitas & okupansi hanya dihitung dari posko yang masih beroperasi.
        const activeCamps = camps.filter((camp) => camp.status === "ACTIVE");
        const activeCampIds = activeCamps.map((camp) => camp.id);
        const ownCampId = user.campId ?? "";
        const campDistributionWhere = {
            OR: [
                { sourceCampId: { in: campIds } },
                { destinationCampId: { in: campIds } },
            ],
        };

        const [
            staffCount,
            activeFamilies,
            specialNeeds,
            logisticsByStatus,
            facilitiesByStatus,
            preparedDistributions,
            shippedDistributions,
            pendingApproval,
            readyToShip,
            awaitingReceipt,
            pendingOwnRequests,
        ] = await Promise.all([
            prisma.user.count({
                where: { campId: { in: campIds } },
            }),

            prisma.evacueeRecord.count({
                where: { campId: { in: activeCampIds }, departedAt: null },
            }),

            prisma.evacueeRecord.count({
                where: { campId: { in: activeCampIds }, departedAt: null, hasSpecialNeeds: true },
            }),

            scope.logistics
                ? prisma.logisticsItem.groupBy({
                    by: ["status"],
                    where: { campId: { in: campIds } },
                    _count: { _all: true },
                })
                : [],

            scope.shelter
                ? prisma.facilityReport.groupBy({
                    by: ["status"],
                    where: { campId: { in: campIds } },
                    _count: { _all: true },
                })
                : [],

            // Query terpisah per status agar daftar "dikirim" tidak tertutup daftar "disiapkan".
            scope.distribution
                ? prisma.distribution.findMany({
                    where: { ...campDistributionWhere, status: "RESERVED" },
                    orderBy: { updatedAt: "desc" },
                    take: DISTRIBUTION_LIST_SIZE,
                    select: distributionSelect,
                })
                : [],

            scope.distribution
                ? prisma.distribution.findMany({
                    where: { ...campDistributionWhere, status: { in: ["SHIPPED", "RECEIVED"] } },
                    orderBy: { updatedAt: "desc" },
                    take: DISTRIBUTION_LIST_SIZE,
                    select: distributionSelect,
                })
                : [],

            actionKeys.has("pendingApproval")
                ? prisma.logisticsRequest.count({ where: { status: "PENDING" } })
                : 0,

            actionKeys.has("readyToShip")
                ? prisma.distribution.count({ where: { status: "RESERVED", sourceCampId: ownCampId } })
                : 0,

            actionKeys.has("awaitingReceipt")
                ? prisma.distribution.count({ where: { status: "SHIPPED", destinationCampId: ownCampId } })
                : 0,

            actionKeys.has("pendingOwnRequests")
                ? prisma.logisticsRequest.count({ where: { status: "PENDING", destinationCampId: ownCampId } })
                : 0,
        ]);

        const totalCapacity = activeCamps.reduce(
            (sum, camp) => sum + camp.maxCapacity,
            0,
        );

        const totalOccupants = activeCamps.reduce(
            (sum, camp) => sum + camp.currentOccupants,
            0,
        );

        const campRows = camps.map((camp) => ({
            ...camp,
            availableCapacity: Math.max(camp.maxCapacity - camp.currentOccupants, 0),
            occupancyPercentage: occupancyPercentage(camp.currentOccupants, camp.maxCapacity),
        }));

        const actionItems = buildActionItems(actionKeys, {
            pendingApproval,
            readyToShip,
            awaitingReceipt,
            pendingOwnRequests,
            criticalLogistics: sumStatusCounts(logisticsByStatus, CRITICAL_LOGISTICS_STATUSES),
            lowLogistics: sumStatusCounts(logisticsByStatus, ["LOW"]),
            damagedFacilities: sumStatusCounts(facilitiesByStatus, DAMAGED_FACILITY_STATUSES),
            nearFullCamps: campRows.filter((camp) => camp.status === "ACTIVE" && camp.occupancyPercentage >= NEAR_FULL_OCCUPANCY_PERCENTAGE).length,
        });

        return NextResponse.json({
            success: true,
            data: {
                scope,
                hasCampAssignment: user.role === "SUPER_ADMIN" || Boolean(user.campId),
                summary: {
                    totalCamps: camps.length,
                    activeCamps: activeCamps.length,
                    totalCapacity,
                    totalOccupants,
                    availableCapacity: Math.max(totalCapacity - totalOccupants, 0),
                    occupancyPercentage: occupancyPercentage(totalOccupants, totalCapacity),
                    activePeople: totalOccupants,
                    activeFamilies,
                    specialNeeds,
                    staffCount,
                },
                logistics: scope.logistics
                    ? {
                        total: sumStatusCounts(logisticsByStatus),
                        problem: sumStatusCounts(logisticsByStatus, PROBLEM_LOGISTICS_STATUSES),
                        critical: sumStatusCounts(logisticsByStatus, CRITICAL_LOGISTICS_STATUSES),
                    }
                    : null,
                facilities: scope.shelter
                    ? {
                        total: sumStatusCounts(facilitiesByStatus),
                        problem: sumStatusCounts(facilitiesByStatus, PROBLEM_FACILITY_STATUSES),
                        damaged: sumStatusCounts(facilitiesByStatus, DAMAGED_FACILITY_STATUSES),
                    }
                    : null,
                distributions: scope.distribution
                    ? { prepared: preparedDistributions, shipped: shippedDistributions }
                    : null,
                actionItems,
                camps: campRows,
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
