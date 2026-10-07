import { describe, expect, it } from "vitest";
import { parseCampInput, campValidationMessage } from "../src/lib/camp-validation";

describe("camp validation", () => {
	it("accepts valid camp input", () => {
		const parsed = parseCampInput({
			name: "Posko A",
			address: "Jl. Merdeka 1",
			latitude: -7.5,
			longitude: 112.5,
			maxCapacity: 200,
			status: "ACTIVE",
		});
		expect(parsed).toEqual({
			name: "Posko A",
			address: "Jl. Merdeka 1",
			latitude: -7.5,
			longitude: 112.5,
			maxCapacity: 200,
			status: "ACTIVE",
		});
	});

	it("trims name and address", () => {
		const parsed = parseCampInput({
			name: "  Posko A  ",
			address: "  Alamat  ",
			latitude: 0,
			longitude: 0,
			maxCapacity: 1,
			status: "ACTIVE",
		});
		expect(parsed.name).toBe("Posko A");
		expect(parsed.address).toBe("Alamat");
	});

	it("rejects empty name", () => {
		expect(() => parseCampInput({
			name: "   ",
			address: "Alamat",
			latitude: 0,
			longitude: 0,
			maxCapacity: 100,
			status: "ACTIVE",
		})).toThrow("NAME_TOO_SHORT");
	});

	it("rejects empty address", () => {
		expect(() => parseCampInput({
			name: "Test",
			address: "",
			latitude: 0,
			longitude: 0,
			maxCapacity: 100,
			status: "ACTIVE",
		})).toThrow("ADDRESS_TOO_SHORT");
	});

	it("rejects latitude out of range", () => {
		expect(() => parseCampInput({
			name: "X",
			address: "Y",
			latitude: 200,
			longitude: 0,
			maxCapacity: 100,
			status: "ACTIVE",
		})).toThrow("LAT_TOO_HIGH");

		expect(() => parseCampInput({
			name: "X",
			address: "Y",
			latitude: -91,
			longitude: 0,
			maxCapacity: 100,
			status: "ACTIVE",
		})).toThrow("LAT_TOO_LOW");
	});

	it("rejects longitude out of range", () => {
		expect(() => parseCampInput({
			name: "X",
			address: "Y",
			latitude: 0,
			longitude: 181,
			maxCapacity: 100,
			status: "ACTIVE",
		})).toThrow("LONG_TOO_HIGH");
	});

	it("rejects non-positive capacity", () => {
		expect(() => parseCampInput({
			name: "X",
			address: "Y",
			latitude: 0,
			longitude: 0,
			maxCapacity: 0,
			status: "ACTIVE",
		})).toThrow("MAX_CAPACITY_TOO_LOW");
	});

	it("rejects capacity below current occupants", () => {
		expect(() => parseCampInput({
			name: "X",
			address: "Y",
			latitude: 0,
			longitude: 0,
			maxCapacity: 50,
			status: "ACTIVE",
		}, 100)).toThrow("CAPACITY_BELOW_OCCUPANTS");
	});

	it("rejects invalid status", () => {
		expect(() => parseCampInput({
			name: "X",
			address: "Y",
			latitude: 0,
			longitude: 0,
			maxCapacity: 100,
			status: "INVALID",
		})).toThrow("STATUS_INVALID");
	});

	it("returns localized error message", () => {
		try {
			parseCampInput({
				name: "",
				address: "Y",
				latitude: 0,
				longitude: 0,
				maxCapacity: 100,
				status: "ACTIVE",
			});
			expect.fail("should have thrown");
		} catch (error) {
			const message = campValidationMessage(error);
			expect(message).toBe("Nama wajib diisi.");
		}
	});
});