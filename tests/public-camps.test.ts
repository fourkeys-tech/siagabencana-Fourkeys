import { describe, expect, it } from "vitest";
import {
	availabilityFor,
	buildShareText,
	distanceKm,
	facilityKind,
	filterAndSortCamps,
	findNearestOpenCamp,
	formatDistance,
	formatRelativeTime,
	matchesFilter,
	parseFilterParam,
	parseSortParam,
} from "../src/lib/public-camps";

type TestCamp = Parameters<typeof filterAndSortCamps>[0][number];

function camp(overrides: Partial<TestCamp> & { name: string }): TestCamp {
	return {
		address: "Sidoarjo",
		latitude: -7.45,
		longitude: 112.7,
		availability: "AVAILABLE",
		availableCapacity: 10,
		occupancyPercentage: 50,
		...overrides,
	};
}

describe("availabilityFor", () => {
	it("uses 80% and 100% thresholds", () => {
		expect(availabilityFor(0)).toBe("AVAILABLE");
		expect(availabilityFor(79.99)).toBe("AVAILABLE");
		expect(availabilityFor(80)).toBe("LIMITED");
		expect(availabilityFor(99.99)).toBe("LIMITED");
		expect(availabilityFor(100)).toBe("FULL");
		expect(availabilityFor(120)).toBe("FULL");
	});
});

describe("distanceKm", () => {
	it("returns 0 for identical points", () => {
		expect(distanceKm({ latitude: -7.4, longitude: 112.7 }, { latitude: -7.4, longitude: 112.7 })).toBe(0);
	});

	it("approximates one degree of latitude as ~111 km", () => {
		const km = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
		expect(km).toBeGreaterThan(110);
		expect(km).toBeLessThan(112);
	});

	it("is symmetric", () => {
		const a = { latitude: -7.45, longitude: 112.71 };
		const b = { latitude: -7.26, longitude: 112.75 };
		expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
	});
});

describe("formatDistance", () => {
	it("shows meters below 1 km", () => {
		expect(formatDistance(0.456)).toBe("460 m");
		expect(formatDistance(0)).toBe("0 m");
	});

	it("shows kilometers with Indonesian decimal separator", () => {
		expect(formatDistance(2.345)).toBe("2,3 km");
		expect(formatDistance(12)).toBe("12 km");
	});

	it("does not render 1000 m", () => {
		expect(formatDistance(0.999)).toBe("1 km");
	});
});

describe("facilityKind", () => {
	it("maps seed facility names", () => {
		expect(facilityKind("Toilet")).toBe("TOILET");
		expect(facilityKind("Penyediaan Air")).toBe("WATER");
		expect(facilityKind("Listrik")).toBe("POWER");
		expect(facilityKind("Tenda Pengungsian")).toBe("SHELTER");
		expect(facilityKind("Pos Kesehatan")).toBe("HEALTH");
		expect(facilityKind("Gudang")).toBe("OTHER");
	});
});

describe("matchesFilter", () => {
	it("treats ATTENTION as LIMITED or FULL", () => {
		expect(matchesFilter("AVAILABLE", "ATTENTION")).toBe(false);
		expect(matchesFilter("LIMITED", "ATTENTION")).toBe(true);
		expect(matchesFilter("FULL", "ATTENTION")).toBe(true);
		expect(matchesFilter("FULL", "ALL")).toBe(true);
		expect(matchesFilter("FULL", "LIMITED")).toBe(false);
	});
});

describe("filterAndSortCamps", () => {
	const camps = [
		camp({ name: "Balai Desa Candi", address: "Jl. Raya Candi", availableCapacity: 5, occupancyPercentage: 90, availability: "LIMITED", distance: 1.2 }),
		camp({ name: "GOR Delta", address: "Jl. Pahlawan Sidoarjo", availableCapacity: 120, occupancyPercentage: 20, distance: 4.5 }),
		camp({ name: "Masjid Agung", address: "Jl. Sultan Agung", availableCapacity: 0, occupancyPercentage: 100, availability: "FULL", distance: 0.4 }),
	];

	it("filters by availability", () => {
		expect(filterAndSortCamps(camps, { filter: "ATTENTION", query: "", sort: "NAME" }).map((item) => item.name)).toEqual([
			"Balai Desa Candi",
			"Masjid Agung",
		]);
	});

	it("matches every search term across name and address", () => {
		expect(filterAndSortCamps(camps, { filter: "ALL", query: "  gor  sidoarjo ", sort: "NAME" }).map((item) => item.name)).toEqual(["GOR Delta"]);
		expect(filterAndSortCamps(camps, { filter: "ALL", query: "gor candi", sort: "NAME" })).toHaveLength(0);
	});

	it("sorts by distance, by capacity and by occupancy", () => {
		expect(filterAndSortCamps(camps, { filter: "ALL", query: "", sort: "DISTANCE" }).map((item) => item.name)).toEqual([
			"Masjid Agung",
			"Balai Desa Candi",
			"GOR Delta",
		]);
		expect(filterAndSortCamps(camps, { filter: "ALL", query: "", sort: "AVAILABILITY" })[0].name).toBe("GOR Delta");
		expect(filterAndSortCamps(camps, { filter: "ALL", query: "", sort: "OCCUPANCY" })[0].name).toBe("GOR Delta");
	});

	it("puts camps without distance last when sorting by distance", () => {
		const mixed = [camp({ name: "Tanpa Jarak" }), camp({ name: "Dekat", distance: 2 })];
		expect(filterAndSortCamps(mixed, { filter: "ALL", query: "", sort: "DISTANCE" }).map((item) => item.name)).toEqual(["Dekat", "Tanpa Jarak"]);
	});

	it("does not mutate the input array", () => {
		const copy = [...camps];
		filterAndSortCamps(camps, { filter: "ALL", query: "", sort: "NAME" });
		expect(camps).toEqual(copy);
	});
});

describe("findNearestOpenCamp", () => {
	it("skips full camps", () => {
		const nearest = findNearestOpenCamp([
			camp({ name: "Penuh", availability: "FULL", distance: 0.2 }),
			camp({ name: "Jauh", distance: 5 }),
			camp({ name: "Terbatas", availability: "LIMITED", distance: 1 }),
		]);
		expect(nearest?.name).toBe("Terbatas");
	});

	it("returns null without distance data", () => {
		expect(findNearestOpenCamp([camp({ name: "A" })])).toBeNull();
	});
});

describe("buildShareText", () => {
	it("includes status, directions and page link", () => {
		const text = buildShareText(
			{ name: "GOR Delta", address: "Sidoarjo", latitude: -7.45, longitude: 112.7, availability: "AVAILABLE", availableCapacity: 30, maxCapacity: 200 },
			"https://example.com/public?posko=1",
		);
		expect(text).toContain("Posko Evakuasi: GOR Delta");
		expect(text).toContain("Masih tersedia (sisa 30 dari 200 tempat)");
		expect(text).toContain("https://www.google.com/maps/dir/?api=1&destination=-7.45,112.7");
		expect(text).toContain("https://example.com/public?posko=1");
	});
});

describe("formatRelativeTime", () => {
	const now = new Date("2026-10-29T10:00:00Z").getTime();

	it("formats recent times", () => {
		expect(formatRelativeTime("2026-10-29T09:59:40Z", now)).toBe("baru saja");
		expect(formatRelativeTime("2026-10-29T09:45:00Z", now)).toBe("15 menit lalu");
		expect(formatRelativeTime("2026-10-29T07:00:00Z", now)).toBe("3 jam lalu");
		expect(formatRelativeTime("2026-10-27T10:00:00Z", now)).toBe("2 hari lalu");
	});

	it("returns null for old, empty or invalid values", () => {
		expect(formatRelativeTime("2026-09-01T10:00:00Z", now)).toBeNull();
		expect(formatRelativeTime(null, now)).toBeNull();
		expect(formatRelativeTime("bukan tanggal", now)).toBeNull();
	});
});

describe("URL params", () => {
	it("parses known values and falls back safely", () => {
		expect(parseFilterParam("FULL")).toBe("FULL");
		expect(parseFilterParam("ATTENTION")).toBe("ATTENTION");
		expect(parseFilterParam("hack")).toBe("ALL");
		expect(parseFilterParam(null)).toBe("ALL");
		expect(parseSortParam("NAME")).toBe("NAME");
		expect(parseSortParam("x")).toBeNull();
	});
});
