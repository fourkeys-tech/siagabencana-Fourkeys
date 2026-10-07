import { describe, expect, it } from "vitest";
import { object, v, validationMessage } from "../src/lib/validation";

describe("validation helpers", () => {
	it("parses simple string field", () => {
		const schema = object({ name: v.string("NAME", { minLength: 1 }) });
		expect(schema({ name: "Test" })).toEqual({ name: "Test" });
	});

	it("trims whitespace", () => {
		const schema = object({ name: v.string("NAME", { minLength: 1 }) });
		expect(schema({ name: "  Halo  " })).toEqual({ name: "Halo" });
	});

	it("rejects short string", () => {
		const schema = object({ name: v.string("NAME", { minLength: 3 }) });
		expect(() => schema({ name: "ab" })).toThrow("NAME_TOO_SHORT");
	});

	it("parses integer with range", () => {
		const schema = object({ qty: v.int("QTY", { min: 1, max: 100 }) });
		expect(schema({ qty: 5 })).toEqual({ qty: 5 });
		expect(() => schema({ qty: 0 })).toThrow("QTY_TOO_LOW");
		expect(() => schema({ qty: 200 })).toThrow("QTY_TOO_HIGH");
	});

	it("parses float with range", () => {
		const schema = object({ lat: v.float("LAT", { min: -90, max: 90 }) });
		expect(schema({ lat: -7.5 })).toEqual({ lat: -7.5 });
		expect(() => schema({ lat: 100 })).toThrow("LAT_TOO_HIGH");
	});

	it("validates enum value", () => {
		const schema = object({ role: v.enum("ROLE", ["A", "B", "C"] as const) });
		expect(schema({ role: "A" })).toEqual({ role: "A" });
		expect(() => schema({ role: "Z" })).toThrow("ROLE_INVALID");
	});

	it("treats empty optional string as null", () => {
		const schema = object({ notes: v.optionalString("NOTES") });
		expect(schema({ notes: "" })).toEqual({ notes: null });
		expect(schema({ notes: undefined })).toEqual({ notes: null });
		expect(schema({ notes: "hi" })).toEqual({ notes: "hi" });
	});

	it("returns localized message for known error code", () => {
		const message = validationMessage(new Error("QTY_TOO_LOW"));
		expect(message).toBe("Jumlah minimal 1.");
	});

	it("returns null for unknown error code", () => {
		const message = validationMessage(new Error("UNKNOWN_CODE"));
		expect(message).toBeNull();
	});

	it("accepts complex schema", () => {
		const campSchema = object({
			name: v.string("NAME", { minLength: 1 }),
			latitude: v.float("LAT", { min: -90, max: 90 }),
			longitude: v.float("LONG", { min: -180, max: 180 }),
			maxCapacity: v.int("MAX_CAPACITY", { min: 1 }),
			status: v.enum("STATUS", ["ACTIVE", "CLOSED"] as const),
		});
		const parsed = campSchema({
			name: "Posko A",
			latitude: -7.5,
			longitude: 112.5,
			maxCapacity: 200,
			status: "ACTIVE",
		});
		expect(parsed).toEqual({
			name: "Posko A",
			latitude: -7.5,
			longitude: 112.5,
			maxCapacity: 200,
			status: "ACTIVE",
		});
	});

	it("throws on invalid input with descriptive code", () => {
		const schema = object({ x: v.int("X", { min: 1 }) });
		try {
			schema({ x: "abc" });
			expect.fail("expected throw");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBe("X_NOT_INT");
		}
	});
});