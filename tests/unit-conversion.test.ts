import { describe, expect, it } from "vitest";
import {
	assertUnitDefinition,
	baseUnitsForDimension,
	convertBaseToStock,
	convertRequestedToStock,
	convertToBase,
	defaultUnitDefinition,
	greatestCommonDivisor,
	isPackagingUnit,
	isStandardUnit,
	multiplyToBase,
	normalizeUnit,
	resolveUnitDefinition,
	standardUnitFactor,
	unitDefaults,
	type UnitDefinition,
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

	it("supports explicit package content", () => {
		const packageDefinition = {
			unit: "dus",
			baseUnit: "pcs",
			unitDimension: "COUNT" as const,
			conversionFactor: 24,
			conversionStatus: "CONFIGURED" as const,
		};
		expect(convertToBase(2, packageDefinition)).toBe(48);
		expect(convertRequestedToStock(48, "pcs", packageDefinition)).toBe(2);
	});

	it("records unverified packages in their own unit but blocks cross-unit conversion", () => {
		const definition = defaultUnitDefinition("dus");
		expect(definition).toEqual({ unit: "dus", baseUnit: "dus", unitDimension: "COUNT", conversionFactor: 1, conversionStatus: "NEEDS_REVIEW" });
		expect(convertToBase(3, definition)).toBe(3);
		expect(convertBaseToStock(3, definition)).toBe(3);
		expect(convertRequestedToStock(3, "dus", definition)).toBe(3);
		expect(() => convertRequestedToStock(1, "pcs", definition)).toThrow("CONVERSION_REQUIRED");
	});

	it("still blocks an unverified definition that is not an identity", () => {
		expect(() => convertToBase(1, { unit: "dus", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24, conversionStatus: "NEEDS_REVIEW" })).toThrow("CONVERSION_REQUIRED");
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
			unit: "ember",
			baseUnit: "ember",
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

describe("unit catalog helpers", () => {
	it("normalizes aliases", () => {
		expect(normalizeUnit(" Kardus ")).toBe("dus");
		expect(normalizeUnit("saset")).toBe("sachet");
		expect(normalizeUnit("Kilogram")).toBe("kg");
		expect(normalizeUnit("buah")).toBe("pcs");
	});

	it("separates standard and packaging units", () => {
		for (const unit of ["pcs", "unit", "g", "kg", "ml", "l"]) {
			expect(isStandardUnit(unit)).toBe(true);
			expect(isPackagingUnit(unit)).toBe(false);
		}
		for (const unit of ["dus", "karung", "galon", "botol", "sak", "bungkus", "sachet", "lembar", "pasang", "set", "kaleng"]) {
			expect(isPackagingUnit(unit)).toBe(true);
			expect(isStandardUnit(unit)).toBe(false);
		}
		expect(isPackagingUnit("ember")).toBe(false);
	});

	it("exposes official standard factors", () => {
		expect(standardUnitFactor("kg")).toBe(1000);
		expect(standardUnitFactor("l")).toBe(1000);
		expect(standardUnitFactor("g")).toBe(1);
		expect(standardUnitFactor("dus")).toBeNull();
	});

	it("computes greatest common divisor", () => {
		expect(greatestCommonDivisor(1000, 24)).toBe(8);
		expect(greatestCommonDivisor(0, 5)).toBe(5);
		expect(greatestCommonDivisor(-12, 18)).toBe(6);
	});

	it("lists base units per dimension", () => {
		expect(baseUnitsForDimension("COUNT")).toEqual(["pcs", "unit"]);
		expect(baseUnitsForDimension("MASS")).toEqual(["g"]);
		expect(baseUnitsForDimension("VOLUME")).toEqual(["ml"]);
	});

	it("provides form defaults", () => {
		expect(unitDefaults("kg")).toEqual({ baseUnit: "g", unitDimension: "MASS", conversionFactor: "1000" });
		expect(unitDefaults("dus")).toEqual({ baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: "" });
	});

	it("multiplies balances to base, allowing zero", () => {
		expect(multiplyToBase(0, 24)).toBe(0);
		expect(multiplyToBase(3, 24)).toBe(72);
		expect(() => multiplyToBase(-1, 24)).toThrow("INVALID_QUANTITY");
		expect(() => multiplyToBase(1, 0)).toThrow("INVALID_CONVERSION_FACTOR");
		expect(() => multiplyToBase(2_147_483_647, 2)).toThrow("CONVERSION_OVERFLOW");
	});
});

describe("resolveUnitDefinition", () => {
	it("returns the official definition for standard units", () => {
		expect(resolveUnitDefinition({ unit: "kg" })).toEqual({ unit: "kg", baseUnit: "g", unitDimension: "MASS", conversionFactor: 1000, conversionStatus: "CONFIGURED" });
		expect(resolveUnitDefinition({ unit: "Liter", baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: 1000 })).toMatchObject({ unit: "l", conversionFactor: 1000 });
	});

	it("rejects standard units that deviate from the official definition", () => {
		expect(() => resolveUnitDefinition({ unit: "kg", conversionFactor: 500 })).toThrow("STANDARD_UNIT_MISMATCH");
		expect(() => resolveUnitDefinition({ unit: "kg", baseUnit: "pcs" })).toThrow("STANDARD_UNIT_MISMATCH");
		expect(() => resolveUnitDefinition({ unit: "pcs", unitDimension: "MASS" })).toThrow("STANDARD_UNIT_MISMATCH");
	});

	it("configures packaging with a valid base", () => {
		expect(resolveUnitDefinition({ unit: "dus", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24 })).toEqual({ unit: "dus", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24, conversionStatus: "CONFIGURED" });
		expect(resolveUnitDefinition({ unit: "karung", baseUnit: "g", unitDimension: "MASS", conversionFactor: "25000" })).toMatchObject({ unit: "karung", baseUnit: "g", unitDimension: "MASS", conversionFactor: 25000, conversionStatus: "CONFIGURED" });
	});

	it("infers dimension from the base unit when omitted", () => {
		expect(resolveUnitDefinition({ unit: "galon", baseUnit: "ml", conversionFactor: 19000 })).toMatchObject({ unitDimension: "VOLUME", conversionStatus: "CONFIGURED" });
	});

	it("records packaging without a factor as an unverified identity definition", () => {
		expect(resolveUnitDefinition({ unit: "dus" })).toEqual({ unit: "dus", baseUnit: "dus", unitDimension: "COUNT", conversionFactor: 1, conversionStatus: "NEEDS_REVIEW" });
		expect(resolveUnitDefinition({ unit: "karung", baseUnit: "g", conversionFactor: "" })).toMatchObject({ baseUnit: "karung", conversionStatus: "NEEDS_REVIEW" });
	});

	it("rejects unsupported units and invalid packaging bases", () => {
		expect(() => resolveUnitDefinition({ unit: "ember" })).toThrow("UNIT_NOT_SUPPORTED");
		expect(() => resolveUnitDefinition({})).toThrow("UNIT_REQUIRED");
		expect(() => resolveUnitDefinition({ unit: "dus", baseUnit: "g", unitDimension: "COUNT", conversionFactor: 24 })).toThrow("BASE_UNIT_DIMENSION_MISMATCH");
		expect(() => resolveUnitDefinition({ unit: "dus", baseUnit: "kg", conversionFactor: 24 })).toThrow("BASE_UNIT_DIMENSION_MISMATCH");
		expect(() => resolveUnitDefinition({ unit: "dus", baseUnit: "pcs", conversionFactor: 1 })).toThrow("CONVERSION_DEFINITION_REQUIRED");
		expect(() => resolveUnitDefinition({ unit: "dus", baseUnit: "pcs", conversionFactor: 2.5 })).toThrow("INVALID_CONVERSION_FACTOR");
	});

	it("inherits an existing configured definition for the same unit", () => {
		const existing: UnitDefinition = { unit: "dus", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 24, conversionStatus: "CONFIGURED" };
		expect(resolveUnitDefinition({}, existing)).toEqual(existing);
		expect(resolveUnitDefinition({ unit: "dus" }, existing)).toEqual(existing);
		expect(resolveUnitDefinition({ conversionFactor: 12 }, existing)).toMatchObject({ conversionFactor: 12, baseUnit: "pcs" });
		expect(resolveUnitDefinition({ conversionFactor: null }, existing)).toMatchObject({ baseUnit: "dus", conversionStatus: "NEEDS_REVIEW" });
		// Ganti unit kemasan: definisi lama tidak diwarisi.
		expect(resolveUnitDefinition({ unit: "box" }, existing)).toMatchObject({ unit: "box", conversionStatus: "NEEDS_REVIEW" });
	});
});
