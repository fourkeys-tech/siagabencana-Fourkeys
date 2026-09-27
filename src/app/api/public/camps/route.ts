import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function availabilityFor(occupancyPercentage: number) {
	if (occupancyPercentage >= 100) return "FULL" as const;
	if (occupancyPercentage >= 80) return "LIMITED" as const;
	return "AVAILABLE" as const;
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
			},
			orderBy: { name: "asc" },
		});

		const data = camps.map((camp) => {
			const availableCapacity = Math.max(camp.maxCapacity - camp.currentOccupants, 0);
			const occupancyPercentage = camp.maxCapacity > 0 ? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(2)) : 0;
			return { ...camp, availableCapacity, occupancyPercentage, availability: availabilityFor(occupancyPercentage), lastUpdatedAt: camp.updatedAt.toISOString() };
		});

		return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		console.error("PUBLIC_CAMPS_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil data posko." }, { status: 500 });
	}
}
