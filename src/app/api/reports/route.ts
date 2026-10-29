import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, canManageDivision, getAccessibleCampWhere, isAuthError, requireAuth } from "@/lib/auth/guard";
import { PROBLEM_FACILITY_STATUSES, PROBLEM_LOGISTICS_STATUSES } from "@/lib/status-groups";

function parseDate(value: string | null, endOfDay = false) {
	if (!value) return null;

	const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
	return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
	try {
		const user = await requireAuth();
		const url = new URL(request.url);
		const from = parseDate(url.searchParams.get("from"));
		const to = parseDate(url.searchParams.get("to"), true);

		if (url.searchParams.has("from") && !from) {
			return NextResponse.json(
				{ success: false, message: "Tanggal mulai tidak valid." },
				{ status: 400 },
			);
		}

		if (url.searchParams.has("to") && !to) {
			return NextResponse.json(
				{ success: false, message: "Tanggal akhir tidak valid." },
				{ status: 400 },
			);
		}

		if (from && to && from > to) {
			return NextResponse.json(
				{ success: false, message: "Tanggal mulai tidak boleh melewati tanggal akhir." },
				{ status: 400 },
			);
		}

		const campWhere = getAccessibleCampWhere(user);
		const canViewEvacueeNames = user.role === "SUPER_ADMIN" || user.role === "MANAGER" || Boolean(user.campId && canManageDivision(user, "DATA_REGISTRATION", user.campId));

		const hasDateFilter = url.searchParams.has("from") || url.searchParams.has("to");
		const effectiveFrom = from ?? (hasDateFilter ? null : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
		const effectiveTo = to ?? (hasDateFilter ? null : new Date());
		const period = effectiveFrom || effectiveTo ? { gte: effectiveFrom ?? undefined, lte: effectiveTo ?? undefined } : undefined;

		const camps = await prisma.camp.findMany({
			where: campWhere,
			select: {
				id: true,
				name: true,
				maxCapacity: true,
				currentOccupants: true,
				status: true,
			},
			orderBy: { name: "asc" },
		});
		const campIds = camps.map((camp) => camp.id);

		const [evacuees, logistics, facilities, distributions] = await Promise.all([
			prisma.evacueeRecord.findMany({
				where: {
					campId: { in: campIds },
					...(period ? { arrivedAt: period } : {}),
				},
				select: {
					id: true,
					...(canViewEvacueeNames ? { name: true } : {}),
					totalFamily: true,
					hasSpecialNeeds: true,
					arrivedAt: true,
					departedAt: true,
					camp: { select: { id: true, name: true } },
				},
				orderBy: { arrivedAt: "desc" },
			}),
			prisma.logisticsItem.findMany({
				where: { campId: { in: campIds } },
				select: {
					id: true,
					itemName: true,
					quantity: true,
					unit: true,
					quantityBase: true,
					baseUnit: true,
					conversionStatus: true,
					status: true,
					camp: { select: { id: true, name: true } },
				},
				orderBy: { updatedAt: "desc" },
			}),
			prisma.facilityReport.findMany({
				where: {
					campId: { in: campIds },
					...(period ? { createdAt: period } : {}),
				},
				select: {
					id: true,
					facilityName: true,
					status: true,
					description: true,
					createdAt: true,
					camp: { select: { id: true, name: true } },
				},
				orderBy: { createdAt: "desc" },
			}),
			prisma.distribution.findMany({
				where: {
					OR: [
						{ sourceCampId: { in: campIds } },
						{ destinationCampId: { in: campIds } },
					],
					...(period ? { createdAt: period } : {}),
				},
				select: {
					id: true,
					itemName: true,
					quantity: true,
					unit: true,
					baseQuantity: true,
					baseUnit: true,
					conversionStatus: true,
					status: true,
					createdAt: true,
					shippedAt: true,
					receivedAt: true,
					sourceCamp: { select: { id: true, name: true } },
					destinationCamp: { select: { id: true, name: true } },
				},
				orderBy: { createdAt: "desc" },
			}),
		]);

		const evacueesByCamp = new Map<string, typeof evacuees>();
		for (const record of evacuees) {
			const list = evacueesByCamp.get(record.camp.id);
			if (list) list.push(record);
			else evacueesByCamp.set(record.camp.id, [record]);
		}
		const logisticsByCamp = new Map<string, typeof logistics>();
		for (const item of logistics) {
			const list = logisticsByCamp.get(item.camp.id);
			if (list) list.push(item);
			else logisticsByCamp.set(item.camp.id, [item]);
		}
		const facilitiesByCamp = new Map<string, typeof facilities>();
		for (const facility of facilities) {
			const list = facilitiesByCamp.get(facility.camp.id);
			if (list) list.push(facility);
			else facilitiesByCamp.set(facility.camp.id, [facility]);
		}

		const totalCapacity = camps.reduce((sum, camp) => sum + camp.maxCapacity, 0);
		const totalOccupants = camps.reduce((sum, camp) => sum + camp.currentOccupants, 0);
		const campRows = camps.map((camp) => {
			const campEvacuees = evacueesByCamp.get(camp.id) ?? [];
			const campLogistics = logisticsByCamp.get(camp.id) ?? [];
			const campFacilities = facilitiesByCamp.get(camp.id) ?? [];

			return {
				...camp,
				occupancyPercentage: camp.maxCapacity > 0
					? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(2))
					: 0,
				evacueeRecords: campEvacuees.length,
				evacueeFamilies: campEvacuees.reduce((sum, record) => sum + record.totalFamily, 0),
				logisticsItems: campLogistics.length,
				logisticsQuantity: campLogistics.reduce((sum, item) => sum + item.quantity, 0),
				problemLogistics: campLogistics.filter((item) => PROBLEM_LOGISTICS_STATUSES.includes(item.status)).length,
				damagedFacilities: campFacilities.filter((facility) => PROBLEM_FACILITY_STATUSES.includes(facility.status)).length,
			};
		});

		return NextResponse.json({
			success: true,
			data: {
				period: {
					from: (effectiveFrom ?? from)?.toISOString() ?? null,
					to: (effectiveTo ?? to)?.toISOString() ?? null,
				},
				summary: {
					totalCamps: camps.length,
					totalCapacity,
					totalOccupants,
					occupancyPercentage: totalCapacity > 0
						? Number(((totalOccupants / totalCapacity) * 100).toFixed(2))
						: 0,
					totalEvacueeRecords: evacuees.length,
					totalEvacueeFamilies: evacuees.reduce((sum, record) => sum + record.totalFamily, 0),
					specialNeeds: evacuees.filter((record) => record.hasSpecialNeeds).length,
					logisticsItems: logistics.length,
					logisticsQuantity: logistics.reduce((sum, item) => sum + item.quantity, 0),
					criticalLogistics: logistics.filter((item) => PROBLEM_LOGISTICS_STATUSES.includes(item.status)).length,
					damagedFacilities: facilities.filter((facility) => PROBLEM_FACILITY_STATUSES.includes(facility.status)).length,
					distributions: distributions.length,
					receivedDistributions: distributions.filter((distribution) => distribution.status === "RECEIVED").length,
				},
				camps: campRows,
				canViewEvacueeNames,
				evacuees: canViewEvacueeNames ? evacuees : [],
				logistics,
				facilities,
				distributions,
			},
		});
	} catch (error) {
		if (isAuthError(error)) return authError(error);

		console.error("GET_REPORTS_ERROR", error);
		return NextResponse.json(
			{ success: false, message: "Gagal mengambil data laporan." },
			{ status: 500 },
		);
	}
}
