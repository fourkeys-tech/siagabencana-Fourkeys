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

export const UNIT_DIMENSIONS: readonly UnitDimension[] = ["COUNT", "MASS", "VOLUME"];

// Unit standar: definisinya resmi dan tidak boleh diubah per barang.
const STANDARD_UNITS: Record<string, StandardUnit> = {
	pcs: { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: 1 },
	unit: { baseUnit: "unit", unitDimension: "COUNT", conversionFactor: 1 },
	g: { baseUnit: "g", unitDimension: "MASS", conversionFactor: 1 },
	kg: { baseUnit: "g", unitDimension: "MASS", conversionFactor: 1000 },
	ml: { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: 1 },
	l: { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: 1000 },
};

// Unit kemasan/hitung: isinya berbeda per barang. Tanpa isi terverifikasi, stok dicatat
// per kemasan (konversi identitas) dan konversi lintas unit diblokir.
export const PACKAGING_UNITS = [
	"dus", "box", "paket", "karton", "karung", "sak", "botol", "galon", "kaleng",
	"bungkus", "sachet", "lembar", "pasang", "set",
] as const;

const PACKAGING_UNIT_SET = new Set<string>(PACKAGING_UNITS);

const UNIT_ALIASES: Record<string, string> = {
	pc: "pcs",
	buah: "pcs",
	gram: "g",
	gr: "g",
	kilogram: "kg",
	liter: "l",
	ltr: "l",
	mililiter: "ml",
	milliliter: "ml",
	kardus: "dus",
	kotak: "box",
	saset: "sachet",
};

const SUPPORTED_UNITS = new Set([...Object.keys(STANDARD_UNITS), ...PACKAGING_UNITS]);

const BASE_UNITS_BY_DIMENSION: Record<UnitDimension, readonly string[]> = {
	COUNT: ["pcs", "unit"],
	MASS: ["g"],
	VOLUME: ["ml"],
};

const STANDARD_UNIT_LABELS: Record<string, string> = {
	pcs: "pcs (buah)",
	unit: "unit (peralatan)",
	g: "g (gram)",
	kg: "kg (kilogram)",
	ml: "ml (mililiter)",
	l: "l (liter)",
};

/** Opsi unit untuk form; unit kemasan ditandai karena isinya didefinisikan per barang. */
export const UNIT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	...Object.keys(STANDARD_UNITS).map((unit) => ({ value: unit, label: STANDARD_UNIT_LABELS[unit] ?? unit })),
	...PACKAGING_UNITS.map((unit) => ({ value: unit, label: `${unit} (kemasan)` })),
];

export const DIMENSION_OPTIONS: ReadonlyArray<{ value: UnitDimension; label: string }> = [
	{ value: "COUNT", label: "Jumlah (pcs/unit)" },
	{ value: "MASS", label: "Massa (g)" },
	{ value: "VOLUME", label: "Volume (ml)" },
];

function standardUnit(unit: string): StandardUnit | undefined {
	return Object.hasOwn(STANDARD_UNITS, unit) ? STANDARD_UNITS[unit] : undefined;
}

export function normalizeUnit(value: unknown) {
	const unit = String(value ?? "").trim().toLowerCase();
	return Object.hasOwn(UNIT_ALIASES, unit) ? UNIT_ALIASES[unit] : unit;
}

export function isStandardUnit(unit: unknown) {
	return standardUnit(normalizeUnit(unit)) !== undefined;
}

export function isPackagingUnit(unit: unknown) {
	return PACKAGING_UNIT_SET.has(normalizeUnit(unit));
}

/** Faktor resmi unit standar terhadap unit dasarnya, atau null untuk unit kemasan. */
export function standardUnitFactor(unit: unknown) {
	return standardUnit(normalizeUnit(unit))?.conversionFactor ?? null;
}

export function inferDimension(unit: unknown): UnitDimension {
	return standardUnit(normalizeUnit(unit))?.unitDimension ?? "COUNT";
}

export function isBaseUnitForDimension(unit: unknown, dimension: UnitDimension) {
	return BASE_UNITS_BY_DIMENSION[dimension].includes(normalizeUnit(unit));
}

export function baseUnitsForDimension(dimension: UnitDimension): string[] {
	return [...(BASE_UNITS_BY_DIMENSION[dimension] ?? [])];
}

export function isUnitDimension(value: unknown): value is UnitDimension {
	return typeof value === "string" && (UNIT_DIMENSIONS as readonly string[]).includes(value);
}

export function greatestCommonDivisor(first: number, second: number) {
	let a = Math.abs(first);
	let b = Math.abs(second);
	while (b !== 0) {
		const remainder = a % b;
		a = b;
		b = remainder;
	}
	return a;
}

/** Nilai awal field definisi unit di form saat unit dipilih. */
export function unitDefaults(unit: unknown): { baseUnit: string; unitDimension: UnitDimension; conversionFactor: string } {
	const standard = standardUnit(normalizeUnit(unit));
	if (standard) return { baseUnit: standard.baseUnit, unitDimension: standard.unitDimension, conversionFactor: String(standard.conversionFactor) };
	return { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: "" };
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
	const standard = standardUnit(normalized);
	return {
		unit: normalized,
		baseUnit: standard?.baseUnit ?? normalized,
		unitDimension: standard?.unitDimension ?? "COUNT",
		conversionFactor: standard?.conversionFactor ?? 1,
		conversionStatus: standard ? "CONFIGURED" : "NEEDS_REVIEW",
	};
}

type UnitInput = {
	unit?: unknown;
	baseUnit?: unknown;
	unitDimension?: unknown;
	conversionFactor?: unknown;
};

function isBlank(value: unknown) {
	return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function needsReviewDefinition(unit: string): UnitDefinition {
	return { unit, baseUnit: unit, unitDimension: "COUNT", conversionFactor: 1, conversionStatus: "NEEDS_REVIEW" };
}

/**
 * Satu aturan definisi unit untuk create & update (status selalu diturunkan, tidak diterima dari input):
 * - unit standar → definisi resmi; input yang menyimpang → STANDARD_UNIT_MISMATCH.
 * - unit kemasan + faktor → CONFIGURED dengan unit dasar yang sah untuk dimensinya.
 * - unit kemasan tanpa faktor → NEEDS_REVIEW (dicatat per kemasan, faktor 1).
 * `conversionFactor: undefined` pada unit yang sama mewarisi definisi lama; `null`/"" menghapusnya.
 */
export function resolveUnitDefinition(input: UnitInput, existing?: UnitDefinition): UnitDefinition {
	const unit = normalizeUnit(isBlank(input.unit) ? existing?.unit : input.unit);
	if (!unit) throw new Error("UNIT_REQUIRED");

	const standard = standardUnit(unit);
	if (standard) {
		const baseUnit = isBlank(input.baseUnit) ? standard.baseUnit : normalizeUnit(input.baseUnit);
		const unitDimension = isBlank(input.unitDimension) ? standard.unitDimension : input.unitDimension;
		const conversionFactor = isBlank(input.conversionFactor) ? standard.conversionFactor : Number(input.conversionFactor);
		if (baseUnit !== standard.baseUnit || unitDimension !== standard.unitDimension || conversionFactor !== standard.conversionFactor) {
			throw new Error("STANDARD_UNIT_MISMATCH");
		}
		return { unit, ...standard, conversionStatus: "CONFIGURED" };
	}
	if (!PACKAGING_UNIT_SET.has(unit)) throw new Error("UNIT_NOT_SUPPORTED");

	const inherited = existing && normalizeUnit(existing.unit) === unit && existing.conversionStatus === "CONFIGURED" ? existing : undefined;
	const factorInput = input.conversionFactor === undefined ? inherited?.conversionFactor : input.conversionFactor;
	if (isBlank(factorInput)) return needsReviewDefinition(unit);

	const baseUnit = normalizeUnit(isBlank(input.baseUnit) ? inherited?.baseUnit : input.baseUnit);
	if (!baseUnit) throw new Error("UNIT_REQUIRED");
	let unitDimension: UnitDimension | undefined;
	if (isBlank(input.unitDimension)) {
		unitDimension = inherited?.baseUnit === baseUnit ? inherited.unitDimension : UNIT_DIMENSIONS.find((dimension) => isBaseUnitForDimension(baseUnit, dimension));
	} else if (isUnitDimension(input.unitDimension)) {
		unitDimension = input.unitDimension;
	}
	if (!unitDimension || !isBaseUnitForDimension(baseUnit, unitDimension)) throw new Error("BASE_UNIT_DIMENSION_MISMATCH");

	return assertUnitDefinition({ unit, baseUnit, unitDimension, conversionFactor: Number(factorInput), conversionStatus: "CONFIGURED" });
}

function assertSafeQuantity(quantity: number) {
	if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
}

function multiplySafe(quantity: number, factor: number) {
	const result = quantity * factor;
	if (!Number.isSafeInteger(result) || result > MAX_DATABASE_INTEGER) throw new Error("CONVERSION_OVERFLOW");
	return result;
}

/** Saldo (boleh 0) × faktor, untuk menghitung ulang kolom dasar saat isi kemasan diverifikasi. */
export function multiplyToBase(quantity: number, factor: number) {
	if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("INVALID_QUANTITY");
	if (!Number.isSafeInteger(factor) || factor <= 0 || factor > MAX_DATABASE_INTEGER) throw new Error("INVALID_CONVERSION_FACTOR");
	return multiplySafe(quantity, factor);
}

// Barang kemasan yang belum diverifikasi dicatat dalam unitnya sendiri (1 dus = 1 dus).
function isIdentityDefinition(definition: UnitDefinition) {
	return definition.unit === definition.baseUnit && definition.conversionFactor === 1;
}

function assertConvertible(definition: UnitDefinition) {
	const validated = assertUnitDefinition(definition);
	if (validated.conversionStatus !== "CONFIGURED" && !isIdentityDefinition(validated)) throw new Error("CONVERSION_REQUIRED");
	return validated;
}

export function convertToBase(quantity: number, definition: UnitDefinition) {
	assertSafeQuantity(quantity);
	const validated = assertConvertible(definition);
	return multiplySafe(quantity, validated.conversionFactor);
}

export function convertBaseToStock(baseQuantity: number, definition: UnitDefinition) {
	assertSafeQuantity(baseQuantity);
	const validated = assertConvertible(definition);
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
