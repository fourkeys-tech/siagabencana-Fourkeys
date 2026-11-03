import { describe } from "vitest";
import type { DivisionType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Di-set oleh setup.ts setelah TEST_DATABASE_URL lolos guard.
export const hasTestDatabase = process.env.INTEGRATION_DB_READY === "1";

/** describe yang otomatis di-skip bila TEST_DATABASE_URL tidak di-set. */
export const describeDb = describe.skipIf(!hasTestDatabase);

const TABLES = [
	"InventoryMovement",
	"Distribution",
	"LogisticsRequest",
	"LogisticsItem",
	"FacilityReport",
	"EvacueeRecord",
	"CampDivisionHead",
	"AuditLog",
	"Session",
	"User",
	"Camp",
];

export async function resetDatabase() {
	const list = TABLES.map((table) => `"${table}"`).join(", ");
	await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let sequence = 0;
const next = () => ++sequence;

export async function createCamp(data: Partial<{ name: string; maxCapacity: number; currentOccupants: number; status: "ACTIVE" | "CLOSED" }> = {}) {
	const n = next();
	return prisma.camp.create({
		data: {
			name: data.name ?? `Posko ${n}`,
			address: `Alamat ${n}`,
			latitude: -7.4,
			longitude: 112.7,
			maxCapacity: data.maxCapacity ?? 100,
			currentOccupants: data.currentOccupants ?? 0,
			status: data.status ?? "ACTIVE",
		},
	});
}

export async function createUser(data: { role?: Role; division?: DivisionType | null; campId?: string | null; email?: string } = {}) {
	const n = next();
	return prisma.user.create({
		data: {
			name: `User ${n}`,
			email: data.email ?? `user${n}@test.local`,
			password: "hash-tidak-dipakai",
			role: data.role ?? "SUPER_ADMIN",
			division: data.division ?? null,
			campId: data.campId ?? null,
		},
	});
}

/** Item satuan COUNT (factor 1) supaya quantity == quantityBase dan mudah diverifikasi. */
export async function createItem(campId: string, data: Partial<{ itemName: string; quantity: number; minimumQuantity: number; unit: string }> = {}) {
	const quantity = data.quantity ?? 10;
	const minimumQuantity = data.minimumQuantity ?? 0;
	return prisma.logisticsItem.create({
		data: {
			campId,
			itemName: data.itemName ?? "Beras",
			unit: data.unit ?? "pcs",
			baseUnit: "pcs",
			unitDimension: "COUNT",
			conversionFactor: 1,
			conversionStatus: "CONFIGURED",
			quantity,
			quantityBase: quantity,
			minimumQuantity,
			minimumQuantityBase: minimumQuantity,
			status: "SUFFICIENT",
		},
	});
}

export async function createRequest(input: { sourceCampId: string; destinationCampId: string; createdById: string; itemName?: string; quantity: number; unit?: string }) {
	return prisma.logisticsRequest.create({
		data: {
			sourceCampId: input.sourceCampId,
			destinationCampId: input.destinationCampId,
			createdById: input.createdById,
			itemName: input.itemName ?? "Beras",
			quantity: input.quantity,
			unit: input.unit ?? "pcs",
			status: "PENDING",
		},
	});
}

export function item(id: string) {
	return prisma.logisticsItem.findUniqueOrThrow({ where: { id } });
}
