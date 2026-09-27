import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function availabilityFor(occupancyPercentage: number) {
	if (occupancyPercentage >= 100) return "FULL" as const;
	if (occupancyPercentage >= 80) return "LIMITED" as const;
	return "AVAILABLE" as const;
}

function latestDate(values: Date[]) {
	return values.reduce((latest, value) => value > latest ? value : latest, new Date(0)).toISOString();
}

export async function GET() {
	try {
		const camps = await prisma.camp.findMany({
			where: { status: "ACTIVE" },
			select: {
				id: true,
				name: true,
				address: true,
				latitude: true,
				longitude: true,
				maxCapacity: true,
				currentOccupants: true,
				status: true,
				updatedAt: true,
				logistics: {
					select: { id: true, itemName: true, status: true, updatedAt: true },
				},
				facilities: {
					select: { id: true, facilityName: true, status: true, updatedAt: true },
				},
			},
			orderBy: { name: "asc" },
		});

		const data = camps.map((camp) => {
			const availableCapacity = Math.max(camp.maxCapacity - camp.currentOccupants, 0);
			const occupancyPercentage = camp.maxCapacity > 0 ? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(2)) : 0;
			const lastUpdatedAt = latestDate([
				camp.updatedAt,
				...camp.logistics.map((item) => item.updatedAt),
				...camp.facilities.map((facility) => facility.updatedAt),
			]);

			return {
				id: camp.id,
				name: camp.name,
				address: camp.address,
				latitude: camp.latitude,
				longitude: camp.longitude,
				maxCapacity: camp.maxCapacity,
				currentOccupants: camp.currentOccupants,
				availableCapacity,
				occupancyPercentage,
				status: camp.status,
				availability: availabilityFor(occupancyPercentage),
				lastUpdatedAt,
				logistics: camp.logistics.map((item) => ({ id: item.id, itemName: item.itemName, status: item.status })),
				facilities: camp.facilities.map((facility) => ({ id: facility.id, facilityName: facility.facilityName, status: facility.status })),
			};
		});

		const summary = {
			totalActiveCamps: data.length,
			totalCapacity: data.reduce((sum, camp) => sum + camp.maxCapacity, 0),
			totalOccupants: data.reduce((sum, camp) => sum + camp.currentOccupants, 0),
			totalAvailableCapacity: data.reduce((sum, camp) => sum + camp.availableCapacity, 0),
			availableCamps: data.filter((camp) => camp.availability === "AVAILABLE").length,
			limitedCamps: data.filter((camp) => camp.availability === "LIMITED").length,
			fullCamps: data.filter((camp) => camp.availability === "FULL").length,
			criticalLogistics: data.reduce((sum, camp) => sum + camp.logistics.filter((item) => ["LOW", "CRITICAL", "SPOILED_OR_DAMAGED"].includes(item.status)).length, 0),
			damagedFacilities: data.reduce((sum, camp) => sum + camp.facilities.filter((facility) => ["DAMAGED", "REPAIRING"].includes(facility.status)).length, 0),
			lastUpdatedAt: data.length > 0 ? latestDate(data.map((camp) => new Date(camp.lastUpdatedAt))) : null,
		};

		return NextResponse.json({ success: true, data: { summary, camps } }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		console.error("PUBLIC_OVERVIEW_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil data overview." }, { status: 500 });
	}
}
