import type { CampStatus } from "@prisma/client";
import { object, v, validationMessage } from "./validation";

export type CampInput = {
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	status: CampStatus;
};

const campStatusValues: CampStatus[] = ["ACTIVE", "CLOSED"];

const campSchema = object({
	name: v.string("NAME", { minLength: 1, maxLength: 120 }),
	address: v.string("ADDRESS", { minLength: 1, maxLength: 240 }),
	latitude: v.float("LAT", { min: -90, max: 90 }),
	longitude: v.float("LONG", { min: -180, max: 180 }),
	maxCapacity: v.int("MAX_CAPACITY", { min: 1 }),
	status: v.enum("STATUS", campStatusValues),
});

export function parseCampInput(input: unknown, currentOccupants = 0): CampInput {
	const parsed = campSchema(input);
	if (parsed.maxCapacity < currentOccupants) {
		throw new Error("CAPACITY_BELOW_OCCUPANTS");
	}
	return parsed;
}

export { validationMessage as campValidationMessage };