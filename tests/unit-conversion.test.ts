import { describe, expect, it } from "vitest";
import {
	assertUnitDefinition,
	convertBaseToStock,
	convertRequestedToStock,
	convertToBase,
	defaultUnitDefinition,
} from "@/lib/unit-conversion";

describe("unit conversion", () => {
	it("uses grams as canonical mass unit", () => {
		const definition = defaultUnitDefinition("kg");
		expect(definition).toMatchObject({ unit: "kg", baseUnit: "g", conversionFactor: 1000, unitDimension: "MASS" });
		expect(convertToBase(2, definition)).toBe(2000);
		expect(convertRequestedToStock(2000, "g", definition)).toBe(2);
	});

	it("converts liters to milliliters", () => {
		const definition = defaultUnitDefinition("l");
		expect(definition).toMatchObject({ unit: "l", baseUnit: "ml", conversionFactor: 1000, unitDimension: "VOLUME" });
		expect(convertToBase(2, definition)).toBe(2000);
		expect(convertRequestedToStock(2000, "ml", definition)).toBe(2);
	});

	it("rejects non-exact stock quantities", () => {
		const definition = { ...defaultUnitDefinition("kg"), conversionStatus: "CONFIGURED" as const };
		expect(() => convertBaseToStock(1500, definition)).toThrow("CONVERSION_NOT_EXACT");
	});

	it("supports explicit package content and blocks unknown packages", () => {
		const packageDefinition = {
			unit: "dus",
			baseUnit: "pcs",
			unitDimension: "COUNT" as const,
			conversionFactor: 24,
			conversionStatus: "CONFIGURED" as const,
		};
		expect(convertToBase(2, packageDefinition)).toBe(48);
		expect(convertRequestedToStock(48, "pcs", packageDefinition)).toBe(2);
		expect(() => convertToBase(1, defaultUnitDefinition("dus"))).toThrow("CONVERSION_REQUIRED");
	});

	it("rejects cross-dimensional conversion", () => {
		const definition = { ...defaultUnitDefinition("kg"), conversionStatus: "CONFIGURED" as const };
		expect(() => convertRequestedToStock(1, "pcs", definition)).toThrow("UNIT_CONVERSION_NOT_SUPPORTED");
	});

	it("does not treat equipment units as pieces", () => {
		const definition = { ...defaultUnitDefinition("unit"), conversionStatus: "CONFIGURED" as const };
		expect(() => convertRequestedToStock(1, "pcs", definition)).toThrow("UNIT_CONVERSION_NOT_SUPPORTED");
	});

	it("rejects units outside the supported unit catalog", () => {
		expect(() => assertUnitDefinition({
			unit: "karung",
			baseUnit: "karung",
			unitDimension: "COUNT",
			conversionFactor: 1,
			conversionStatus: "NEEDS_REVIEW",
		})).toThrow("UNIT_NOT_SUPPORTED");
	});

	it("rejects configured definitions with missing factor", () => {
		expect(() => assertUnitDefinition({ unit: "dus", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 1, conversionStatus: "CONFIGURED" })).toThrow("CONVERSION_DEFINITION_REQUIRED");
	});

	it("rejects conversion results above PostgreSQL INTEGER range", () => {
		expect(() => convertToBase(2_147_483_648, defaultUnitDefinition("pcs"))).toThrow("CONVERSION_OVERFLOW");
	});

	it("does not accept an unverified package factor on its own unit", () => {
		expect(() => assertUnitDefinition({
			unit: "dus",
			baseUnit: "dus",
			unitDimension: "COUNT",
			conversionFactor: 24,
			conversionStatus: "NEEDS_REVIEW",
		})).toThrow("CONVERSION_DEFINITION_REQUIRED");
	});
});
