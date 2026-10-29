// Validator sederhana yang reusable untuk semua POST/PUT endpoint.
// Pola parsing ketat: Number.isInteger, trim string, range check.
// Mengikuti style `src/lib/camp-validation.ts` agar konsisten.

type Validator<T> = {
	parse(input: unknown): T;
};

function fail(message: string): never {
	throw new Error(message);
}

function requireString(input: unknown, field: string, opts: { minLength?: number; maxLength?: number } = {}): string {
	if (typeof input !== "string") fail(`${field}_NOT_STRING`);
	const trimmed = input.trim();
	if (opts.minLength !== undefined && trimmed.length < opts.minLength) fail(`${field}_TOO_SHORT`);
	if (opts.maxLength !== undefined && trimmed.length > opts.maxLength) fail(`${field}_TOO_LONG`);
	return trimmed;
}

function optionalString(input: unknown, field: string): string | null {
	if (input === null || input === undefined || input === "") return null;
	return requireString(input, field);
}

function requireInt(input: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
	const num = Number(input);
	if (!Number.isFinite(num) || !Number.isInteger(num)) fail(`${field}_NOT_INT`);
	if (opts.min !== undefined && num < opts.min) fail(`${field}_TOO_LOW`);
	if (opts.max !== undefined && num > opts.max) fail(`${field}_TOO_HIGH`);
	return num;
}

function optionalInt(input: unknown, field: string, opts: { min?: number; max?: number } = {}): number | null {
	if (input === null || input === undefined || input === "") return null;
	return requireInt(input, field, opts);
}

function requireFloat(input: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
	const num = Number(input);
	if (!Number.isFinite(num)) fail(`${field}_NOT_NUMBER`);
	if (opts.min !== undefined && num < opts.min) fail(`${field}_TOO_LOW`);
	if (opts.max !== undefined && num > opts.max) fail(`${field}_TOO_HIGH`);
	return num;
}

function requireEnum<T extends string>(input: unknown, field: string, allowed: readonly T[]): T {
	const value = String(input ?? "");
	if (!allowed.includes(value as T)) fail(`${field}_INVALID`);
	return value as T;
}

function optionalEnum<T extends string>(input: unknown, field: string, allowed: readonly T[]): T | null {
	if (input === null || input === undefined || input === "") return null;
	return requireEnum(input, field, allowed);
}

function requireBoolean(input: unknown, field: string): boolean {
	if (typeof input === "boolean") return input;
	if (input === "true") return true;
	if (input === "false") return false;
	fail(`${field}_NOT_BOOLEAN`);
}

export const PASSWORD_MIN_LENGTH = 8;

// Kebijakan password konsisten untuk create user, edit user, dan ubah profil.
export function validatePassword(input: unknown): string | null {
	if (typeof input !== "string") return "Password harus berupa teks.";
	if (input.length < PASSWORD_MIN_LENGTH) return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
	if (input.length > 128) return "Password maksimal 128 karakter.";
	return null;
}

// Jumlah anggota keluarga harus bilangan bulat ≥ 1 (NaN, desimal, 0 ditolak).
export function isValidTotalFamily(input: unknown) {
	const value = Number(input);
	return Number.isSafeInteger(value) && value >= 1;
}

export const MAX_NAME_LENGTH = 120;
export const MAX_NOTE_LENGTH = 1000;
export const MAX_EMAIL_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: unknown): input is string {
	return typeof input === "string" && input.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(input);
}

// Teks wajib: trim, tidak kosong, tidak melebihi batas. Mengembalikan pesan error atau null.
export function validateText(input: unknown, label: string, maxLength = MAX_NAME_LENGTH): string | null {
	if (typeof input !== "string" || !input.trim()) return `${label} wajib diisi.`;
	if (input.trim().length > maxLength) return `${label} maksimal ${maxLength} karakter.`;
	return null;
}

// Teks opsional (notes, alasan): boleh kosong, tetap dibatasi panjangnya.
export function validateOptionalText(input: unknown, label: string, maxLength = MAX_NOTE_LENGTH): string | null {
	if (input === undefined || input === null || input === "") return null;
	if (typeof input !== "string") return `${label} harus berupa teks.`;
	if (input.trim().length > maxLength) return `${label} maksimal ${maxLength} karakter.`;
	return null;
}

// Boolean dari JSON/form: hanya true/false atau "true"/"false"; selain itu undefined.
export function parseBoolean(input: unknown): boolean | undefined {
	if (typeof input === "boolean") return input;
	if (input === "true") return true;
	if (input === "false") return false;
	return undefined;
}

// Mapping error code ke pesan user-friendly (Bahasa Indonesia).
export const validationMessages: Record<string, string> = {
	NAME_NOT_STRING: "Nama harus berupa teks.",
	NAME_TOO_SHORT: "Nama wajib diisi.",
	ADDRESS_NOT_STRING: "Alamat harus berupa teks.",
	ADDRESS_TOO_SHORT: "Alamat wajib diisi.",
	ITEM_NAME_NOT_STRING: "Nama barang harus berupa teks.",
	ITEM_NAME_TOO_SHORT: "Nama barang wajib diisi.",
	FACILITY_NAME_NOT_STRING: "Nama fasilitas harus berupa teks.",
	FACILITY_NAME_TOO_SHORT: "Nama fasilitas wajib diisi.",
	DESCRIPTION_NOT_STRING: "Deskripsi harus berupa teks.",
	DESCRIPTION_TOO_SHORT: "Deskripsi wajib diisi.",
	NOTES_NOT_STRING: "Catatan harus berupa teks.",
	REJECTION_REASON_NOT_STRING: "Alasan penolakan harus berupa teks.",
	REJECTION_REASON_TOO_SHORT: "Alasan penolakan wajib diisi.",
	EMAIL_NOT_STRING: "Email harus berupa teks.",
	PASSWORD_NOT_STRING: "Password harus berupa teks.",
	QUANTITY_NOT_INT: "Jumlah harus berupa bilangan bulat.",
	QUANTITY_TOO_LOW: "Jumlah minimal 1.",
	QTY_NOT_INT: "Jumlah harus berupa bilangan bulat.",
	QTY_TOO_LOW: "Jumlah minimal 1.",
	QTY_TOO_HIGH: "Jumlah melebihi batas.",
	TOTAL_FAMILY_NOT_INT: "Jumlah keluarga harus berupa bilangan bulat.",
	TOTAL_FAMILY_TOO_LOW: "Jumlah keluarga minimal 1.",
	MAX_CAPACITY_NOT_INT: "Kapasitas harus berupa bilangan bulat.",
	MAX_CAPACITY_TOO_LOW: "Kapasitas minimal 1.",
	MIN_QUANTITY_NOT_INT: "Batas minimum harus berupa bilangan bulat.",
	LAT_NOT_NUMBER: "Latitude tidak valid.",
	LAT_TOO_LOW: "Latitude terlalu kecil.",
	LAT_TOO_HIGH: "Latitude terlalu besar.",
	LONG_NOT_NUMBER: "Longitude tidak valid.",
	LONG_TOO_LOW: "Longitude terlalu kecil.",
	LONG_TOO_HIGH: "Longitude terlalu besar.",
	LATITUDE_NOT_NUMBER: "Latitude tidak valid.",
	LONGITUDE_NOT_NUMBER: "Longitude tidak valid.",
	ROLE_INVALID: "Peran tidak valid.",
	DIVISION_INVALID: "Divisi tidak valid.",
	STATUS_INVALID: "Status tidak valid.",
	CAMP_ID_INVALID: "Posko tidak valid.",
	CAPACITY_BELOW_OCCUPANTS: "Kapasitas maksimal tidak boleh lebih kecil dari jumlah penghuni saat ini.",
};

export function validationMessage(error: unknown) {
	if (!(error instanceof Error)) return null;
	return validationMessages[error.message] ?? null;
}

// Schema pembangun validasi dengan API mirip Zod.
export const v = {
	string: (field: string, opts?: { minLength?: number; maxLength?: number }) => (input: unknown) =>
		requireString(input, field, opts),
	optionalString: (field: string) => (input: unknown) => optionalString(input, field),
	int: (field: string, opts?: { min?: number; max?: number }) => (input: unknown) =>
		requireInt(input, field, opts),
	optionalInt: (field: string, opts?: { min?: number; max?: number }) => (input: unknown) =>
		optionalInt(input, field, opts),
	float: (field: string, opts?: { min?: number; max?: number }) => (input: unknown) =>
		requireFloat(input, field, opts),
	enum: <T extends string>(field: string, allowed: readonly T[]) => (input: unknown) =>
		requireEnum(input, field, allowed),
	optionalEnum: <T extends string>(field: string, allowed: readonly T[]) => (input: unknown) =>
		optionalEnum(input, field, allowed),
	boolean: (field: string) => (input: unknown) => requireBoolean(input, field),
};

// Builder object schema.
type SchemaField = (input: unknown) => unknown;

export function object<S extends Record<string, SchemaField>>(shape: S) {
		return (input: unknown): { [K in keyof S]: ReturnType<S[K]> } => {
			const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
			const result: Record<string, unknown> = {};
			for (const key of Object.keys(shape)) {
				result[key] = shape[key](data[key]);
			}
			return result as { [K in keyof S]: ReturnType<S[K]> };
		};
	}

export type { Validator };