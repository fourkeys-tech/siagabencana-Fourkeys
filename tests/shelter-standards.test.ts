import { describe, expect, it } from "vitest";
import {
	ASSESSED_CATEGORIES,
	assessFacilities,
	describeShortfall,
	MAX_FACILITY_QUANTITY,
	parseFacilityCategory,
	parseFacilityQuantity,
	requiredQuantity,
	sufficiencySummary,
	type FacilityCategory,
	type FacilityStatusValue,
} from "@/lib/shelter-standards";

type Row = { category: FacilityCategory; quantity: number; status: FacilityStatusValue };

/** Fasilitas lengkap & cukup untuk 100 jiwa. */
function completeFor100(): Row[] {
	return [
		{ category: "HOUSING", quantity: 350, status: "GOOD" },
		{ category: "TOILET", quantity: 5, status: "GOOD" },
		{ category: "WATER", quantity: 1500, status: "GOOD" },
		{ category: "POWER", quantity: 1, status: "GOOD" },
		{ category: "KITCHEN", quantity: 1, status: "GOOD" },
		{ category: "HEALTH", quantity: 1, status: "GOOD" },
	];
}

describe("parseFacilityCategory", () => {
	it("menerima kategori valid tanpa peduli huruf besar/kecil & spasi", () => {
		expect(parseFacilityCategory("TOILET")).toBe("TOILET");
		expect(parseFacilityCategory(" water ")).toBe("WATER");
	});

	it("menolak nilai di luar daftar", () => {
		expect(parseFacilityCategory("SHELTER")).toBeNull();
		expect(parseFacilityCategory("")).toBeNull();
		expect(parseFacilityCategory(3)).toBeNull();
		expect(parseFacilityCategory(null)).toBeNull();
	});
});

describe("parseFacilityQuantity", () => {
	it("menerima bilangan bulat positif dari angka atau string", () => {
		expect(parseFacilityQuantity(1)).toBe(1);
		expect(parseFacilityQuantity("25")).toBe(25);
		expect(parseFacilityQuantity(" 7 ")).toBe(7);
		expect(parseFacilityQuantity(MAX_FACILITY_QUANTITY)).toBe(MAX_FACILITY_QUANTITY);
	});

	it("menolak nol, negatif, pecahan, notasi aneh, dan melebihi batas", () => {
		for (const input of [0, -1, 1.5, "1.5", "1e3", "abc", "", "-3", MAX_FACILITY_QUANTITY + 1, Number.NaN, Infinity, null, undefined, true]) {
			expect(parseFacilityQuantity(input)).toBeNull();
		}
	});
});

describe("requiredQuantity", () => {
	it("menghitung kebutuhan per standar Sphere dan membulatkan ke atas", () => {
		expect(requiredQuantity("TOILET", 100)).toBe(5);
		expect(requiredQuantity("TOILET", 101)).toBe(6);
		expect(requiredQuantity("WATER", 10)).toBe(150);
		expect(requiredQuantity("HOUSING", 3)).toBe(11); // 10,5 m² → 11
		expect(requiredQuantity("POWER", 1)).toBe(1);
	});

	it("posko kosong tidak butuh apa pun; OTHER tidak dinilai", () => {
		expect(requiredQuantity("TOILET", 0)).toBe(0);
		expect(requiredQuantity("HEALTH", 0)).toBe(0);
		expect(requiredQuantity("TOILET", -5)).toBe(0);
		expect(requiredQuantity("OTHER", 100)).toBeNull();
	});
});

describe("assessFacilities", () => {
	it("SUFFICIENT bila semua kategori terpenuhi", () => {
		const result = assessFacilities(100, completeFor100());
		expect(result.overall).toBe("SUFFICIENT");
		expect(result.categories.map((item) => item.category)).toEqual(ASSESSED_CATEGORIES);
		expect(result.categories.every((item) => item.status === "SUFFICIENT")).toBe(true);
	});

	it("hanya unit berstatus Baik yang dihitung tersedia", () => {
		const rows = completeFor100().filter((row) => row.category !== "TOILET");
		rows.push({ category: "TOILET", quantity: 3, status: "GOOD" }, { category: "TOILET", quantity: 2, status: "DAMAGED" });
		const toilet = assessFacilities(100, rows).categories.find((item) => item.category === "TOILET");
		expect(toilet).toMatchObject({ total: 5, available: 3, required: 5, shortfall: 2, status: "SHORT" });
	});

	it("kategori wajib-ada yang semuanya rusak dianggap kurang", () => {
		const rows = completeFor100().map((row) => (row.category === "KITCHEN" ? { ...row, status: "REPAIRING" as const } : row));
		const result = assessFacilities(100, rows);
		expect(result.overall).toBe("SHORT");
		expect(result.categories.find((item) => item.category === "KITCHEN")?.status).toBe("SHORT");
	});

	it("kategori tanpa catatan → NO_DATA dan overall INCOMPLETE (bukan SHORT)", () => {
		const rows = completeFor100().filter((row) => row.category !== "WATER");
		const result = assessFacilities(100, rows);
		expect(result.overall).toBe("INCOMPLETE");
		expect(result.categories.find((item) => item.category === "WATER")?.status).toBe("NO_DATA");
	});

	it("SHORT lebih diprioritaskan daripada INCOMPLETE", () => {
		const rows: Row[] = [{ category: "TOILET", quantity: 1, status: "GOOD" }];
		expect(assessFacilities(100, rows).overall).toBe("SHORT");
	});

	it("fasilitas OTHER tidak memengaruhi penilaian", () => {
		const rows = [...completeFor100(), { category: "OTHER" as const, quantity: 1, status: "DAMAGED" as const }];
		expect(assessFacilities(100, rows).overall).toBe("SUFFICIENT");
	});
});

describe("describeShortfall & sufficiencySummary", () => {
	it("menjelaskan kekurangan kuantitatif dan wajib-ada", () => {
		const rows = completeFor100()
			.filter((row) => row.category !== "TOILET" && row.category !== "HEALTH")
			.concat({ category: "TOILET", quantity: 3, status: "GOOD" }, { category: "HEALTH", quantity: 1, status: "DAMAGED" });
		const result = assessFacilities(100, rows);
		const toilet = result.categories.find((item) => item.category === "TOILET");
		const health = result.categories.find((item) => item.category === "HEALTH");
		expect(toilet && describeShortfall(toilet)).toBe("Toilet / MCK kurang 2 bilik");
		expect(health && describeShortfall(health)).toBe("Pos kesehatan tidak berfungsi");
		expect(sufficiencySummary(result)).toBe("Di bawah standar (Toilet / MCK kurang 2 bilik; Pos kesehatan tidak berfungsi)");
	});

	it("ringkasan memuat kategori yang belum didata", () => {
		const rows = completeFor100().filter((row) => row.category !== "POWER" && row.category !== "KITCHEN");
		expect(sufficiencySummary(assessFacilities(100, rows))).toBe("Data belum lengkap (belum didata: Listrik & penerangan, Dapur umum)");
	});

	it("ringkasan singkat bila memenuhi standar", () => {
		expect(sufficiencySummary(assessFacilities(100, completeFor100()))).toBe("Memenuhi standar");
	});
});
