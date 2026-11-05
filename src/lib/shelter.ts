import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assessFacilities, type FacilityAssessment } from "@/lib/shelter-standards";

export type CampFacilityAssessment = {
	campId: string;
	campName: string;
	campStatus: "ACTIVE" | "CLOSED";
	occupants: number;
	assessment: FacilityAssessment;
};

// Kecukupan fasilitas per posko: jumlah unit Baik dibanding kebutuhan minimum untuk okupan saat ini.
export async function loadCampFacilityAssessments(where: Prisma.CampWhereInput): Promise<CampFacilityAssessment[]> {
	const camps = await prisma.camp.findMany({
		where,
		orderBy: { name: "asc" },
		select: {
			id: true,
			name: true,
			status: true,
			currentOccupants: true,
			facilities: { select: { category: true, quantity: true, status: true } },
		},
	});

	return camps.map((camp) => ({
		campId: camp.id,
		campName: camp.name,
		campStatus: camp.status,
		occupants: camp.currentOccupants,
		assessment: assessFacilities(camp.currentOccupants, camp.facilities),
	}));
}
