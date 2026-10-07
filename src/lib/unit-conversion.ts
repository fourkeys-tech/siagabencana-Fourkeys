export type UnitDimension = "COUNT" | "MASS" | "VOLUME";
export type UnitConversionStatus = "CONFIGURED" | "NEEDS_REVIEW";

const MAX_DATABASE_INTEGER = 2_147_483_647;

export type UnitDefinition = {
	unit: string;
	baseUnit: string;
	unitDimension: UnitDimension;
	conversionFactor: number;
	conversionStatus: UnitConversionStatus;
};

type StandardUnit = {
	baseUnit: string;
	unitDimension: UnitDimension;
	conversionFactor: number;
};

const UNIT_ALIASES: Record<string, string> = {
	pc: "pcs",
	pcs: "pcs",
	buah: "pcs",
	unit: "unit",
	g: "g",
	gram: "g",
	gr: "g",
	kg: "kg",
	kilogram: "kg",
	l: "l",
	liter: "l",
	ltr: "l",
	ml: "ml",
	mililiter: "ml",
	milliliter: "ml",
	dus: "dus",
	box: "box",
	paket: "paket",
	karton: "karton",
};

const STANDARD_UNITS: Record<string, StandardUnit> = {
	pcs: { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 1 },
	unit: { baseUnit: "unit", unitDimension: "COUNT", conversionFactor: 1 },
	g: { baseUnit: "g", unitDimension: "MASS", conversionFactor: 1 },
	kg: { baseUnit: "g", unitDimension: "MASS", conversionFactor: 1000 },
	ml: { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: 1 },
	l: { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: 1000 },
};

const SUPPORTED_UNITS = new Set([
	...Object.keys(STANDARD_UNITS),
	"dus",
	"box",
	"paket",
	"karton",
]);

const BASE_UNITS_BY_DIMENSION: Record<UnitDimension, Set<string>> = {
	COUNT: new Set(["pcs", "unit"]),
	MASS: new Set(["g"]),
	VOLUME: new Set(["ml"]),
};

const DIMENSION_BY_UNIT: Record<string, UnitDimension> = {
	pcs: "COUNT",
	unit: "COUNT",
	g: "MASS",
	kg: "MASS",
	ml: "VOLUME",
	l: "VOLUME",
};

export function normalizeUnit(value: unknown) {
	const unit = String(value ?? "").trim().toLowerCase();
	return UNIT_ALIASES[unit] ?? unit;
}

export function isSupportedUnit(value: unknown) {
	return SUPPORTED_UNITS.has(normalizeUnit(value));
}

export function inferDimension(unit: unknown): UnitDimension {
	const normalized = normalizeUnit(unit);
	return DIMENSION_BY_UNIT[normalized] ?? "COUNT";
}

export function inferBaseUnit(unit: unknown) {
	const normalized = normalizeUnit(unit);
	return STANDARD_UNITS[normalized]?.baseUnit ?? normalized;
}

export function isBaseUnitForDimension(unit: unknown, dimension: UnitDimension) {
	return BASE_UNITS_BY_DIMENSION[dimension].has(normalizeUnit(unit));
}

export function assertUnitDefinition(definition: UnitDefinition) {
	const unit = normalizeUnit(definition.unit);
	const baseUnit = normalizeUnit(definition.baseUnit);
	if (!unit || !baseUnit) throw new Error("UNIT_REQUIRED");
	if (!SUPPORTED_UNITS.has(unit) || !SUPPORTED_UNITS.has(baseUnit)) throw new Error("UNIT_NOT_SUPPORTED");
	if (!Number.isSafeInteger(definition.conversionFactor) || definition.conversionFactor <= 0 || definition.conversionFactor > MAX_DATABASE_INTEGER) {
		throw new Error("INVALID_CONVERSION_FACTOR");
	}
	if (!isBaseUnitForDimension(baseUnit, definition.unitDimension)
		&& !(definition.conversionStatus === "NEEDS_REVIEW" && unit === baseUnit)) {
		throw new Error("BASE_UNIT_DIMENSION_MISMATCH");
	}
	if (unit !== baseUnit && definition.conversionFactor === 1) {
		throw new Error("CONVERSION_DEFINITION_REQUIRED");
	}
	if (definition.conversionStatus === "NEEDS_REVIEW" && unit === baseUnit && definition.conversionFactor !== 1) {
		throw new Error("CONVERSION_DEFINITION_REQUIRED");
	}
	return { ...definition, unit, baseUnit };
}

export function defaultUnitDefinition(unit: unknown): UnitDefinition {
	const normalized = normalizeUnit(unit);
	const standard = STANDARD_UNITS[normalized];
	return {
		unit: normalized,
		baseUnit: standard?.baseUnit ?? normalized,
		unitDimension: standard?.unitDimension ?? "COUNT",
		conversionFactor: standard?.conversionFactor ?? 1,
		conversionStatus: standard ? "CONFIGURED" : "NEEDS_REVIEW",
	};
}

function assertSafeQuantity(quantity: number) {
	if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
}

function multiplySafe(quantity: number, factor: number) {
	const result = quantity * factor;
	if (!Number.isSafeInteger(result) || result > MAX_DATABASE_INTEGER) throw new Error("CONVERSION_OVERFLOW");
	return result;
}

export function convertToBase(quantity: number, definition: UnitDefinition) {
	assertSafeQuantity(quantity);
	const validated = assertUnitDefinition(definition);
	if (validated.conversionStatus !== "CONFIGURED") {
		throw new Error("CONVERSION_REQUIRED");
	}
	return multiplySafe(quantity, validated.conversionFactor);
}

export function convertBaseToStock(baseQuantity: number, definition: UnitDefinition) {
	assertSafeQuantity(baseQuantity);
	const validated = assertUnitDefinition(definition);
	if (validated.conversionStatus !== "CONFIGURED") throw new Error("CONVERSION_REQUIRED");
	if (baseQuantity > MAX_DATABASE_INTEGER) throw new Error("CONVERSION_OVERFLOW");
	if (baseQuantity % validated.conversionFactor !== 0) throw new Error("CONVERSION_NOT_EXACT");
	return baseQuantity / validated.conversionFactor;
}

export function convertRequestedToStock(quantity: number, requestedUnit: unknown, definition: UnitDefinition) {
	assertSafeQuantity(quantity);
	const validated = assertUnitDefinition(definition);
	const requested = normalizeUnit(requestedUnit);
	if (requested === validated.unit) return quantity;
	if (validated.conversionStatus !== "CONFIGURED") throw new Error("CONVERSION_REQUIRED");
	if (inferDimension(requested) !== validated.unitDimension) throw new Error("UNIT_CONVERSION_NOT_SUPPORTED");

	const requestedDefinition = defaultUnitDefinition(requested);
	if (requestedDefinition.conversionStatus !== "CONFIGURED") throw new Error("UNIT_CONVERSION_NOT_SUPPORTED");
	if (requestedDefinition.baseUnit !== validated.baseUnit) throw new Error("UNIT_CONVERSION_NOT_SUPPORTED");
	const requestedBaseQuantity = multiplySafe(quantity, requestedDefinition.conversionFactor);
	return convertBaseToStock(requestedBaseQuantity, validated);
}

export function conversionLabel(definition: UnitDefinition) {
	const validated = assertUnitDefinition(definition);
	return `1 ${validated.unit} = ${validated.conversionFactor} ${validated.baseUnit}`;
}

export function unitDisplayOptions(definition: UnitDefinition) {
	const validated = assertUnitDefinition(definition);
	const options = [validated.unit];
	if (validated.baseUnit !== validated.unit && validated.conversionStatus === "CONFIGURED") options.push(validated.baseUnit);
	return options;
}
