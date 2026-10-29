import type { DivisionType, Role } from "@prisma/client";
import { canManageDivision } from "@/lib/auth/guard";
import { hasDistributionAccess } from "@/lib/distribution";
import { NEAR_FULL_OCCUPANCY_PERCENTAGE } from "@/lib/status-groups";

export type DashboardUser = {
	id: string;
	role: Role;
	division: DivisionType | null;
	campId: string | null;
};

// Bagian dashboard yang boleh dilihat user, selaras dengan otorisasi API tiap modul.
export type DashboardScope = {
	logistics: boolean;
	shelter: boolean;
	registration: boolean;
	distribution: boolean;
};

export type ActionKey =
	| "pendingApproval"
	| "readyToShip"
	| "awaitingReceipt"
	| "pendingOwnRequests"
	| "criticalLogistics"
	| "lowLogistics"
	| "damagedFacilities"
	| "nearFullCamps";

export type ActionCounts = Partial<Record<ActionKey, number>>;

export type ActionItem = {
	key: ActionKey;
	label: string;
	description: string;
	count: number;
	href: string;
	tone: "danger" | "warning" | "info";
};

const ACTION_DEFINITIONS: Array<Omit<ActionItem, "count">> = [
	{ key: "pendingApproval", label: "Menunggu persetujuan", description: "Permintaan distribusi yang perlu disetujui atau ditolak.", href: "/distribusi", tone: "warning" },
	{ key: "readyToShip", label: "Siap dikirim", description: "Stok sudah dicadangkan. Kirim dari posko Anda.", href: "/distribusi", tone: "info" },
	{ key: "awaitingReceipt", label: "Konfirmasi penerimaan", description: "Barang dalam perjalanan ke posko Anda. Konfirmasi saat tiba.", href: "/distribusi", tone: "info" },
	{ key: "pendingOwnRequests", label: "Menunggu persetujuan pusat", description: "Permintaan posko Anda belum direview Super Admin.", href: "/distribusi", tone: "info" },
	{ key: "criticalLogistics", label: "Stok kritis / rusak", description: "Item logistik yang perlu segera diisi ulang atau diganti.", href: "/logistik", tone: "danger" },
	{ key: "lowLogistics", label: "Stok menipis", description: "Item logistik yang mulai menipis.", href: "/logistik", tone: "warning" },
	{ key: "damagedFacilities", label: "Fasilitas rusak", description: "Laporan fasilitas rusak yang belum ditangani.", href: "/shelter", tone: "danger" },
	{ key: "nearFullCamps", label: "Posko hampir penuh", description: `Okupansi posko aktif ≥ ${NEAR_FULL_OCCUPANCY_PERCENTAGE}%.`, href: "/pengungsi", tone: "warning" },
];

export function getDashboardScope(user: DashboardUser): DashboardScope {
	const canDivision = (division: DivisionType) =>
		user.role === "SUPER_ADMIN" || Boolean(user.campId && canManageDivision(user, division, user.campId));

	return {
		logistics: canDivision("LOGISTICS"),
		shelter: canDivision("SHELTER"),
		registration: canDivision("DATA_REGISTRATION"),
		distribution: hasDistributionAccess(user),
	};
}

// Tugas yang relevan untuk user: approval pusat untuk Super Admin, kirim/terima untuk tim posko.
export function getActionKeys(user: DashboardUser, scope: DashboardScope) {
	const keys = new Set<ActionKey>();

	if (user.role === "SUPER_ADMIN") keys.add("pendingApproval");
	if (scope.distribution && user.role !== "SUPER_ADMIN" && user.campId) {
		keys.add("readyToShip");
		keys.add("awaitingReceipt");
		keys.add("pendingOwnRequests");
	}
	if (scope.logistics) {
		keys.add("criticalLogistics");
		keys.add("lowLogistics");
	}
	if (scope.shelter) keys.add("damagedFacilities");
	if (scope.registration) keys.add("nearFullCamps");

	return keys;
}

export function buildActionItems(keys: ReadonlySet<ActionKey>, counts: ActionCounts): ActionItem[] {
	return ACTION_DEFINITIONS.flatMap((definition) => {
		const count = counts[definition.key] ?? 0;
		return keys.has(definition.key) && count > 0 ? [{ ...definition, count }] : [];
	});
}

export function sumStatusCounts<S extends string>(
	rows: ReadonlyArray<{ status: S; _count: { _all: number } }>,
	statuses?: readonly S[],
) {
	return rows.reduce((sum, row) => (!statuses || statuses.includes(row.status) ? sum + row._count._all : sum), 0);
}

export function occupancyPercentage(occupants: number, capacity: number) {
	return capacity > 0 ? Number(((occupants / capacity) * 100).toFixed(2)) : 0;
}
