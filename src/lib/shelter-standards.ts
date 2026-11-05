// Patokan kecukupan fasilitas posko. Angka mengikuti standar minimum Sphere (Humanitarian Charter and
// Minimum Standards in Humanitarian Response), yang juga dirujuk untuk penampungan sementara pengungsi.
// Modul murni (tanpa Prisma) supaya bisa dipakai di route handler maupun client component.

export const FACILITY_CATEGORIES = ["HOUSING", "TOILET", "WATER", "POWER", "KITCHEN", "HEALTH", "OTHER"] as const;
export type FacilityCategory = (typeof FACILITY_CATEGORIES)[number];
export type FacilityStatusValue = "GOOD" | "DAMAGED" | "REPAIRING";

type Standard =
	/** Kebutuhan = jiwa × perPerson (dibulatkan ke atas). */
	| { kind: "PER_PERSON"; perPerson: number }
	/** Kebutuhan = jiwa ÷ peoplePerUnit (dibulatkan ke atas). */
	| { kind: "PEOPLE_PER_UNIT"; peoplePerUnit: number }
	/** Minimal satu yang berfungsi selama posko berpenghuni. */
	| { kind: "PRESENCE" }
	| { kind: "NONE" };

export type FacilityCategoryInfo = {
	label: string;
	unit: string;
	quantityLabel: string;
	standard: Standard;
	standardLabel: string;
	example: string;
};

export const FACILITY_CATEGORY_INFO: Record<FacilityCategory, FacilityCategoryInfo> = {
	HOUSING: {
		label: "Tenda / Hunian",
		unit: "m²",
		quantityLabel: "Luas hunian (m²)",
		standard: { kind: "PER_PERSON", perPerson: 3.5 },
		standardLabel: "3,5 m² per jiwa",
		example: "Tenda peleton A (±84 m²)",
	},
	TOILET: {
		label: "Toilet / MCK",
		unit: "bilik",
		quantityLabel: "Jumlah bilik",
		standard: { kind: "PEOPLE_PER_UNIT", peoplePerUnit: 20 },
		standardLabel: "1 bilik per 20 jiwa",
		example: "Toilet portabel blok A",
	},
	WATER: {
		label: "Air bersih",
		unit: "L/hari",
		quantityLabel: "Pasokan air (liter per hari)",
		standard: { kind: "PER_PERSON", perPerson: 15 },
		standardLabel: "15 liter per jiwa per hari",
		example: "Tandon + kiriman truk tangki",
	},
	POWER: {
		label: "Listrik & penerangan",
		unit: "unit",
		quantityLabel: "Jumlah unit",
		standard: { kind: "PRESENCE" },
		standardLabel: "Wajib ada",
		example: "Genset 5 kVA",
	},
	KITCHEN: {
		label: "Dapur umum",
		unit: "unit",
		quantityLabel: "Jumlah unit",
		standard: { kind: "PRESENCE" },
		standardLabel: "Wajib ada",
		example: "Dapur umum utama",
	},
	HEALTH: {
		label: "Pos kesehatan",
		unit: "unit",
		quantityLabel: "Jumlah unit",
		standard: { kind: "PRESENCE" },
		standardLabel: "Wajib ada",
		example: "Pos kesehatan PMI",
	},
	OTHER: {
		label: "Lainnya",
		unit: "unit",
		quantityLabel: "Jumlah unit",
		standard: { kind: "NONE" },
		standardLabel: "Tidak dinilai",
		example: "Gudang, tempat ibadah",
	},
};

/** Kategori yang punya patokan (OTHER hanya dicatat). */
export const ASSESSED_CATEGORIES = FACILITY_CATEGORIES.filter((category) => FACILITY_CATEGORY_INFO[category].standard.kind !== "NONE");

export const MAX_FACILITY_QUANTITY = 10_000_000;

export function parseFacilityCategory(input: unknown): FacilityCategory | null {
	if (typeof input !== "string") return null;
	const value = input.trim().toUpperCase();
	return (FACILITY_CATEGORIES as readonly string[]).includes(value) ? (value as FacilityCategory) : null;
}

/** Bilangan bulat 1..MAX_FACILITY_QUANTITY, atau null. */
export function parseFacilityQuantity(input: unknown): number | null {
	if (typeof input === "string" && !/^\s*\d+\s*$/.test(input)) return null;
	if (typeof input !== "string" && typeof input !== "number") return null;
	const value = Number(input);
	return Number.isSafeInteger(value) && value >= 1 && value <= MAX_FACILITY_QUANTITY ? value : null;
}

/** Kebutuhan minimum untuk jumlah jiwa tertentu; null bila kategori tidak dinilai. */
export function requiredQuantity(category: FacilityCategory, occupants: number): number | null {
	const people = Math.max(0, Math.floor(occupants));
	const standard = FACILITY_CATEGORY_INFO[category].standard;
	switch (standard.kind) {
		case "PER_PERSON":
			return Math.ceil(people * standard.perPerson);
		case "PEOPLE_PER_UNIT":
			return Math.ceil(people / standard.peoplePerUnit);
		case "PRESENCE":
			return people > 0 ? 1 : 0;
		default:
			return null;
	}
}

export type SufficiencyStatus = "SUFFICIENT" | "SHORT" | "NO_DATA";
export type OverallSufficiency = "SUFFICIENT" | "SHORT" | "INCOMPLETE";

export type CategoryAssessment = {
	category: FacilityCategory;
	label: string;
	unit: string;
	standardLabel: string;
	/** Seluruh jumlah tercatat (termasuk yang rusak). */
	total: number;
	/** Hanya yang berstatus Baik. */
	available: number;
	required: number;
	shortfall: number;
	status: SufficiencyStatus;
};

export type FacilityAssessment = {
	overall: OverallSufficiency;
	categories: CategoryAssessment[];
};

export function assessFacilities(
	occupants: number,
	facilities: ReadonlyArray<{ category: FacilityCategory; quantity: number; status: FacilityStatusValue }>,
): FacilityAssessment {
	const categories = ASSESSED_CATEGORIES.map((category): CategoryAssessment => {
		const info = FACILITY_CATEGORY_INFO[category];
		const rows = facilities.filter((facility) => facility.category === category);
		const total = rows.reduce((sum, facility) => sum + facility.quantity, 0);
		const available = rows.filter((facility) => facility.status === "GOOD").reduce((sum, facility) => sum + facility.quantity, 0);
		const required = requiredQuantity(category, occupants) ?? 0;
		const status: SufficiencyStatus = total === 0 ? "NO_DATA" : available >= required ? "SUFFICIENT" : "SHORT";
		return {
			category,
			label: info.label,
			unit: info.unit,
			standardLabel: info.standardLabel,
			total,
			available,
			required,
			shortfall: Math.max(required - available, 0),
			status,
		};
	});

	const overall: OverallSufficiency = categories.some((item) => item.status === "SHORT")
		? "SHORT"
		: categories.some((item) => item.status === "NO_DATA")
			? "INCOMPLETE"
			: "SUFFICIENT";

	return { overall, categories };
}

export function formatFacilityQuantity(value: number, unit: string) {
	return `${value.toLocaleString("id-ID")} ${unit}`;
}

/** "Toilet / MCK kurang 7 bilik" atau "Dapur umum tidak berfungsi". */
export function describeShortfall(item: CategoryAssessment) {
	if (FACILITY_CATEGORY_INFO[item.category].standard.kind === "PRESENCE") return `${item.label} tidak berfungsi`;
	return `${item.label} kurang ${formatFacilityQuantity(item.shortfall, item.unit)}`;
}

export const overallSufficiencyLabels: Record<OverallSufficiency, string> = {
	SUFFICIENT: "Memenuhi standar",
	SHORT: "Di bawah standar",
	INCOMPLETE: "Data belum lengkap",
};

/** Ringkasan satu baris untuk laporan/CSV. */
export function sufficiencySummary(assessment: FacilityAssessment) {
	const short = assessment.categories.filter((item) => item.status === "SHORT").map(describeShortfall);
	const missing = assessment.categories.filter((item) => item.status === "NO_DATA").map((item) => item.label);
	if (assessment.overall === "SUFFICIENT") return overallSufficiencyLabels.SUFFICIENT;
	const parts = [
		...(short.length > 0 ? [short.join("; ")] : []),
		...(missing.length > 0 ? [`belum didata: ${missing.join(", ")}`] : []),
	];
	return `${overallSufficiencyLabels[assessment.overall]} (${parts.join("; ")})`;
}
