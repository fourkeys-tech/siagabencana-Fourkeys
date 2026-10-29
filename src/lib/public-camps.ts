export type Availability = "AVAILABLE" | "LIMITED" | "FULL";
export type AvailabilityFilter = "ALL" | "ATTENTION" | Availability;
export type CampSort = "AVAILABILITY" | "DISTANCE" | "OCCUPANCY" | "NAME";
export type FacilityKind = "TOILET" | "WATER" | "POWER" | "HEALTH" | "SHELTER" | "KITCHEN" | "OTHER";

type Coordinates = { latitude: number; longitude: number };

type ListableCamp = Coordinates & {
	name: string;
	address: string;
	availability: Availability;
	availableCapacity: number;
	occupancyPercentage: number;
	distance?: number;
};

const FILTERS: AvailabilityFilter[] = ["ALL", "ATTENTION", "AVAILABLE", "LIMITED", "FULL"];
const SORTS: CampSort[] = ["AVAILABILITY", "DISTANCE", "OCCUPANCY", "NAME"];
const EARTH_RADIUS_KM = 6371;

// Urutan penting: kata kunci yang lebih spesifik dicek lebih dulu.
const FACILITY_KEYWORDS: [FacilityKind, string[]][] = [
	["TOILET", ["toilet", "mck", "kamar mandi"]],
	["WATER", ["air", "tandon", "pompa"]],
	["POWER", ["listrik", "genset", "lampu"]],
	["HEALTH", ["medis", "kesehatan", "obat", "pmi", "klinik"]],
	["SHELTER", ["tenda", "barak", "tidur"]],
	["KITCHEN", ["dapur", "makan"]],
];

export const availabilityLabels: Record<Availability, string> = {
	AVAILABLE: "Masih tersedia",
	LIMITED: "Kapasitas terbatas",
	FULL: "Penuh",
};

// Warna pin peta mengikuti ambang ketersediaan (80% / 100%), sama dengan legenda halaman publik.
export const availabilityColors: Record<Availability, string> = {
	AVAILABLE: "#059669",
	LIMITED: "#d97706",
	FULL: "#be123c",
};

export const availabilityBarClasses: Record<Availability, string> = {
	AVAILABLE: "bg-emerald-500",
	LIMITED: "bg-amber-500",
	FULL: "bg-rose-600",
};

export function availabilityFor(occupancyPercentage: number): Availability {
	if (occupancyPercentage >= 100) return "FULL";
	if (occupancyPercentage >= 80) return "LIMITED";
	return "AVAILABLE";
}

function toRadians(degrees: number) {
	return (degrees * Math.PI) / 180;
}

/** Jarak garis lurus (haversine) dalam kilometer. */
export function distanceKm(from: Coordinates, to: Coordinates) {
	const dLat = toRadians(to.latitude - from.latitude);
	const dLon = toRadians(to.longitude - from.longitude);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number) {
	const meters = Math.round(km * 100) * 10;
	if (meters < 1000) return `${meters} m`;
	return `${km.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}

export function directionsUrl(camp: Coordinates) {
	return `https://www.google.com/maps/dir/?api=1&destination=${camp.latitude},${camp.longitude}`;
}

export function facilityKind(name: string): FacilityKind {
	const lower = name.toLowerCase();
	return FACILITY_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))?.[0] ?? "OTHER";
}

export function matchesFilter(availability: Availability, filter: AvailabilityFilter) {
	if (filter === "ALL") return true;
	if (filter === "ATTENTION") return availability !== "AVAILABLE";
	return availability === filter;
}

export function filterAndSortCamps<T extends ListableCamp>(
	camps: T[],
	options: { filter: AvailabilityFilter; query: string; sort: CampSort },
) {
	const terms = options.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	return camps
		.filter((camp) => matchesFilter(camp.availability, options.filter))
		.filter((camp) => {
			if (terms.length === 0) return true;
			const haystack = `${camp.name} ${camp.address}`.toLowerCase();
			return terms.every((term) => haystack.includes(term));
		})
		.sort((first, second) => {
			if (options.sort === "DISTANCE" && first.distance !== second.distance) {
				if (first.distance === undefined) return 1;
				if (second.distance === undefined) return -1;
				return first.distance - second.distance;
			}
			if (options.sort === "NAME") return first.name.localeCompare(second.name, "id");
			if (options.sort === "OCCUPANCY" && first.occupancyPercentage !== second.occupancyPercentage) {
				return first.occupancyPercentage - second.occupancyPercentage;
			}
			if (first.availableCapacity !== second.availableCapacity) return second.availableCapacity - first.availableCapacity;
			return first.name.localeCompare(second.name, "id");
		});
}

/** Posko terdekat yang masih bisa menerima pengungsi (bukan FULL). */
export function findNearestOpenCamp<T extends ListableCamp>(camps: T[]) {
	return camps.reduce<T | null>((nearest, camp) => {
		if (camp.availability === "FULL" || camp.distance === undefined) return nearest;
		if (!nearest || nearest.distance === undefined || camp.distance < nearest.distance) return camp;
		return nearest;
	}, null);
}

export function buildShareText(
	camp: Coordinates & { name: string; address: string; availability: Availability; availableCapacity: number; maxCapacity: number },
	pageUrl: string,
) {
	return [
		`Posko Evakuasi: ${camp.name}`,
		`Alamat: ${camp.address}`,
		`Status: ${availabilityLabels[camp.availability]} (sisa ${camp.availableCapacity} dari ${camp.maxCapacity} tempat)`,
		`Petunjuk arah: ${directionsUrl(camp)}`,
		`Info terkini: ${pageUrl}`,
	].join("\n");
}

export function formatRelativeTime(value: string | null | undefined, now: number) {
	if (!value) return null;
	const time = new Date(value).getTime();
	if (Number.isNaN(time)) return null;
	const minutes = Math.floor((now - time) / 60_000);
	if (minutes < 1) return "baru saja";
	if (minutes < 60) return `${minutes} menit lalu`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} jam lalu`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days} hari lalu`;
	return null;
}

export function parseFilterParam(value: string | null): AvailabilityFilter {
	return FILTERS.find((filter) => filter === value) ?? "ALL";
}

export function parseSortParam(value: string | null): CampSort | null {
	return SORTS.find((sort) => sort === value) ?? null;
}
