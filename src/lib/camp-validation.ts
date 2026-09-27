import { CampStatus } from "@prisma/client";

export type CampInput = {
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	status: CampStatus;
};

type CampInputValues = {
	name?: unknown;
	address?: unknown;
	latitude?: unknown;
	longitude?: unknown;
	maxCapacity?: unknown;
	status?: unknown;
};

function parseFiniteNumber(value: unknown, label: string) {
	if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
		throw new Error(`${label}_REQUIRED`);
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) throw new Error(`${label}_INVALID`);
	return parsed;
}

export function parseCampInput(input: CampInputValues, currentOccupants = 0): CampInput {
	const name = String(input.name ?? "").trim();
	const address = String(input.address ?? "").trim();
	if (!name) throw new Error("NAME_REQUIRED");
	if (!address) throw new Error("ADDRESS_REQUIRED");

	const latitude = parseFiniteNumber(input.latitude, "LATITUDE");
	const longitude = parseFiniteNumber(input.longitude, "LONGITUDE");
	const maxCapacity = parseFiniteNumber(input.maxCapacity, "CAPACITY");
	const status = String(input.status ?? "ACTIVE");

	if (latitude < -90 || latitude > 90) throw new Error("LATITUDE_RANGE");
	if (longitude < -180 || longitude > 180) throw new Error("LONGITUDE_RANGE");
	if (!Number.isInteger(maxCapacity) || maxCapacity <= 0) throw new Error("CAPACITY_INVALID");
	if (maxCapacity < currentOccupants) throw new Error("CAPACITY_BELOW_OCCUPANTS");
	if (!(["ACTIVE", "CLOSED"] as string[]).includes(status)) throw new Error("STATUS_INVALID");

	return {
		name,
		address,
		latitude,
		longitude,
		maxCapacity,
		status: status as CampStatus,
	};
}

export function campValidationMessage(error: unknown) {
	if (!(error instanceof Error)) return null;
	const messages: Record<string, string> = {
		NAME_REQUIRED: "Nama posko wajib diisi.",
		ADDRESS_REQUIRED: "Alamat posko wajib diisi.",
		LATITUDE_REQUIRED: "Pilih lokasi posko pada peta.",
		LONGITUDE_REQUIRED: "Pilih lokasi posko pada peta.",
		LATITUDE_INVALID: "Titik lokasi memiliki latitude yang tidak valid.",
		LONGITUDE_INVALID: "Titik lokasi memiliki longitude yang tidak valid.",
		LATITUDE_RANGE: "Latitude harus berada antara -90 dan 90.",
		LONGITUDE_RANGE: "Longitude harus berada antara -180 dan 180.",
		CAPACITY_REQUIRED: "Kapasitas maksimal wajib diisi.",
		CAPACITY_INVALID: "Kapasitas maksimal harus berupa bilangan bulat positif.",
		CAPACITY_BELOW_OCCUPANTS: "Kapasitas maksimal tidak boleh lebih kecil dari jumlah penghuni saat ini.",
		STATUS_INVALID: "Status posko tidak valid.",
	};
	return messages[error.message] ?? null;
}
