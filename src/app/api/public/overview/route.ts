import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
				logistics: {
					select: {
						id: true,
						itemName: true,
						quantity: true,
						unit: true,
						status: true,
					},
				},
				facilities: {
					select: {
						id: true,
						facilityName: true,
						status: true,
					},
				},
			},
			orderBy: { name: "asc" },
		});

		const data = camps.map((camp) => {
			const { logistics, facilities, ...rest } = camp;

			return {
				...rest,
				availableCapacity: camp.maxCapacity - camp.currentOccupants,
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
				logistics,
				facilities,
			};
		});

		const summary = {
			totalActiveCamps: data.length,
			totalCapacity: data.reduce(
				(sum, camp) => sum + camp.maxCapacity,
				0,
			),
			totalOccupants: data.reduce(
				(sum, camp) => sum + camp.currentOccupants,
				0,
			),
			criticalLogistics: data.reduce(
				(sum, camp) =>
					sum +
					camp.logistics.filter((item) =>
						["LOW", "CRITICAL", "SPOILED_OR_DAMAGED"].includes(
							item.status,
						),
					).length,
				0,
			),
			damagedFacilities: data.reduce(
				(sum, camp) =>
					sum +
					camp.facilities.filter((facility) =>
						["DAMAGED", "REPAIRING"].includes(facility.status),
					).length,
				0,
			),
		};

		return NextResponse.json({
			success: true,
			data: { summary, camps: data },
		});
	} catch (error) {
		console.error("PUBLIC_OVERVIEW_ERROR", error);

		return NextResponse.json(
			{
				success: false,
				message: "Gagal mengambil data overview.",
			},
			{ status: 500 },
		);
	}
}
