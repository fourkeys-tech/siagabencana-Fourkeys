import { describe, expect, it } from "vitest";
import { buildActionItems, getActionKeys, getDashboardScope, occupancyPercentage, sumStatusCounts, type DashboardUser } from "../src/lib/dashboard";

const admin: DashboardUser = { id: "a", role: "SUPER_ADMIN", division: null, campId: null };
const manager: DashboardUser = { id: "m", role: "MANAGER", division: null, campId: "camp1" };
const logisticsHead: DashboardUser = { id: "h", role: "DIVISION_HEAD", division: "LOGISTICS", campId: "camp1" };
const shelterOfficer: DashboardUser = { id: "f", role: "FIELD_OFFICER", division: "SHELTER", campId: "camp1" };
const unassignedOfficer: DashboardUser = { id: "u", role: "FIELD_OFFICER", division: "LOGISTICS", campId: null };

describe("dashboard scope", () => {
	it("Super Admin melihat semua bagian", () => {
		expect(getDashboardScope(admin)).toEqual({ logistics: true, shelter: true, registration: true, distribution: true });
	});

	it("Manager melihat semua divisi poskonya", () => {
		expect(getDashboardScope(manager)).toEqual({ logistics: true, shelter: true, registration: true, distribution: true });
	});

	it("Ketua logistik hanya melihat logistik & distribusi", () => {
		expect(getDashboardScope(logisticsHead)).toEqual({ logistics: true, shelter: false, registration: false, distribution: true });
	});

	it("Field Officer shelter tidak melihat logistik/distribusi", () => {
		expect(getDashboardScope(shelterOfficer)).toEqual({ logistics: false, shelter: true, registration: false, distribution: false });
	});

	it("user tanpa posko tidak melihat apa pun", () => {
		expect(getDashboardScope(unassignedOfficer)).toEqual({ logistics: false, shelter: false, registration: false, distribution: false });
	});
});

describe("dashboard action items", () => {
	it("Super Admin mendapat antrian persetujuan, bukan tugas kirim/terima", () => {
		const keys = getActionKeys(admin, getDashboardScope(admin));
		expect(keys.has("pendingApproval")).toBe(true);
		expect(keys.has("readyToShip")).toBe(false);
		expect(keys.has("awaitingReceipt")).toBe(false);
	});

	it("Ketua logistik mendapat tugas kirim/terima dan stok", () => {
		const keys = getActionKeys(logisticsHead, getDashboardScope(logisticsHead));
		expect([...keys].sort()).toEqual(["awaitingReceipt", "criticalLogistics", "lowLogistics", "pendingOwnRequests", "readyToShip"]);
	});

	it("Field Officer shelter hanya mendapat fasilitas rusak", () => {
		const keys = getActionKeys(shelterOfficer, getDashboardScope(shelterOfficer));
		expect([...keys]).toEqual(["damagedFacilities"]);
	});

	it("buildActionItems membuang hitungan nol dan key di luar scope", () => {
		const keys = getActionKeys(shelterOfficer, getDashboardScope(shelterOfficer));
		const items = buildActionItems(keys, { damagedFacilities: 2, criticalLogistics: 5, pendingApproval: 0 });
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ key: "damagedFacilities", count: 2, href: "/shelter" });
		expect(buildActionItems(keys, { damagedFacilities: 0 })).toEqual([]);
	});
});

describe("dashboard helpers", () => {
	const rows = [
		{ status: "LOW" as const, _count: { _all: 2 } },
		{ status: "CRITICAL" as const, _count: { _all: 3 } },
		{ status: "SUFFICIENT" as const, _count: { _all: 10 } },
	];

	it("sumStatusCounts menjumlah total atau status tertentu", () => {
		expect(sumStatusCounts(rows)).toBe(15);
		expect(sumStatusCounts(rows, ["LOW", "CRITICAL"])).toBe(5);
	});

	it("occupancyPercentage aman untuk kapasitas nol", () => {
		expect(occupancyPercentage(5, 0)).toBe(0);
		expect(occupancyPercentage(45, 50)).toBe(90);
	});
});
