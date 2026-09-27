import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function availabilityFor(occupancyPercentage: number) {
	if (occupancyPercentage >= 100) return "FULL" as const;
	if (occupancyPercentage >= 80) return "LIMITED" as const;
	return "AVAILABLE" as const;
}

function latestDate(values: Date[]) {
	return values.reduce((latest, value) => value > latest ? value : latest, new Date(0)).toISOString();
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Params) {
	try {
		const { id } = await params;
		const camp = await prisma.camp.findFirst({
			where: { id, status: "ACTIVE" },
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
				logistics: { select: { id: true, itemName: true, status: true, updatedAt: true } },
				facilities: { select: { id: true, facilityName: true, status: true, updatedAt: true } },
			},
		});

		if (!camp) return NextResponse.json({ success: false, message: "Posko tidak ditemukan." }, { status: 404 });

		const availableCapacity = Math.max(camp.maxCapacity - camp.currentOccupants, 0);
		const occupancyPercentage = camp.maxCapacity > 0 ? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(2)) : 0;
		const lastUpdatedAt = latestDate([camp.updatedAt, ...camp.logistics.map((item) => item.updatedAt), ...camp.facilities.map((facility) => facility.updatedAt)]);

		return NextResponse.json({ success: true, data: { ...camp, availableCapacity, occupancyPercentage, availability: availabilityFor(occupancyPercentage), lastUpdatedAt, logistics: camp.logistics.map((item) => ({ id: item.id, itemName: item.itemName, status: item.status })), facilities: camp.facilities.map((facility) => ({ id: facility.id, facilityName: facility.facilityName, status: facility.status })) } }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		console.error("PUBLIC_CAMP_DETAIL_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil data posko." }, { status: 500 });
	}
}
