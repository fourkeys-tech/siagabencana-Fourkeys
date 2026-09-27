import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";

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

		const campWhere = user.role === "SUPER_ADMIN" ? {} : { id: user.campId ?? "" };
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
		const period = from || to ? { gte: from ?? undefined, lte: to ?? undefined } : undefined;

		const [evacuees, logistics, facilities, distributions] = await Promise.all([
			prisma.evacueeRecord.findMany({
				where: {
					campId: { in: campIds },
					...(period ? { arrivedAt: period } : {}),
				},
				select: {
					id: true,
					name: true,
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

		const totalCapacity = camps.reduce((sum, camp) => sum + camp.maxCapacity, 0);
		const totalOccupants = camps.reduce((sum, camp) => sum + camp.currentOccupants, 0);
		const campRows = camps.map((camp) => {
			const campEvacuees = evacuees.filter((record) => record.camp.id === camp.id);
			const campLogistics = logistics.filter((item) => item.camp.id === camp.id);
			const campFacilities = facilities.filter((facility) => facility.camp.id === camp.id);

			return {
				...camp,
				occupancyPercentage: camp.maxCapacity > 0
					? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(2))
					: 0,
				evacueeRecords: campEvacuees.length,
				evacueeFamilies: campEvacuees.reduce((sum, record) => sum + record.totalFamily, 0),
				logisticsItems: campLogistics.length,
				logisticsQuantity: campLogistics.reduce((sum, item) => sum + item.quantity, 0),
				problemLogistics: campLogistics.filter((item) => ["LOW", "CRITICAL", "SPOILED_OR_DAMAGED"].includes(item.status)).length,
				damagedFacilities: campFacilities.filter((facility) => ["DAMAGED", "REPAIRING"].includes(facility.status)).length,
			};
		});

		return NextResponse.json({
			success: true,
			data: {
				period: {
					from: from?.toISOString() ?? null,
					to: to?.toISOString() ?? null,
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
					criticalLogistics: logistics.filter((item) => ["LOW", "CRITICAL", "SPOILED_OR_DAMAGED"].includes(item.status)).length,
					damagedFacilities: facilities.filter((facility) => ["DAMAGED", "REPAIRING"].includes(facility.status)).length,
					distributions: distributions.length,
					receivedDistributions: distributions.filter((distribution) => distribution.status === "RECEIVED").length,
				},
				camps: campRows,
				evacuees,
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
