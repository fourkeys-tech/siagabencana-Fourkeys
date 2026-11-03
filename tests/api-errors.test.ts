import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRouteError, uniqueConstraintMessage } from "../src/lib/api-errors";
import { DOMAIN_ERRORS, domainError } from "../src/lib/domain-errors";
import { InvalidJsonError } from "../src/lib/http";
import { uniqueConstraintFields, violatesUnique } from "../src/lib/prisma-errors";

function knownError(code: string, meta?: Record<string, unknown>) {
	return new Prisma.PrismaClientKnownRequestError("test", { code, clientVersion: "test", meta });
}

// Bentuk meta P2002 dari @prisma/adapter-pg (constraint name dari Postgres).
function adapterUnique(index: string) {
	return knownError("P2002", { driverAdapterError: { cause: { kind: "UniqueConstraintViolation", constraint: { index } } } });
}

const options = { context: "TEST_ERROR", fallback: "Gagal." };

async function body(response: Response) {
	return { status: response.status, ...(await response.json()) as { success: boolean; message: string } };
}

describe("uniqueConstraintFields", () => {
	it("membaca meta.target (engine klasik)", () => {
		expect(uniqueConstraintFields(knownError("P2002", { target: ["email"] }))).toEqual(["email"]);
		expect(uniqueConstraintFields(knownError("P2002", { target: "User_email_key" }))).toEqual(["User_email_key"]);
	});

	it("membaca constraint driver adapter (index dan fields)", () => {
		expect(uniqueConstraintFields(adapterUnique("Camp_managerId_key"))).toEqual(["Camp_managerId_key"]);
		const withFields = knownError("P2002", { driverAdapterError: { cause: { constraint: { fields: ["\"campId\"", "\"division\""] } } } });
		expect(uniqueConstraintFields(withFields)).toEqual(["campId", "division"]);
	});

	it("kosong untuk error lain", () => {
		expect(uniqueConstraintFields(knownError("P2003"))).toEqual([]);
		expect(uniqueConstraintFields(new Error("x"))).toEqual([]);
		expect(uniqueConstraintFields(knownError("P2002"))).toEqual([]);
	});

	it("violatesUnique mencocokkan semua kolom constraint", () => {
		expect(violatesUnique(adapterUnique("CampDivisionHead_campId_division_key"), "campId", "division")).toBe(true);
		expect(violatesUnique(adapterUnique("CampDivisionHead_userId_campId_key"), "campId", "division")).toBe(false);
		expect(violatesUnique(adapterUnique("User_email_key"))).toBe(false);
	});
});

describe("uniqueConstraintMessage", () => {
	it("pesan per constraint, bukan selalu email", () => {
		expect(uniqueConstraintMessage(adapterUnique("User_email_key"))).toBe("Email sudah digunakan.");
		expect(uniqueConstraintMessage(adapterUnique("Camp_managerId_key"))).toBe("Manager tersebut sudah memimpin posko lain.");
		expect(uniqueConstraintMessage(adapterUnique("CampDivisionHead_campId_division_key"))).toBe("Divisi tersebut sudah memiliki ketua di posko ini.");
		expect(uniqueConstraintMessage(adapterUnique("CampDivisionHead_userId_campId_key"))).toBe("User sudah menjadi ketua divisi di posko ini.");
		expect(uniqueConstraintMessage(adapterUnique("Unknown_key"))).toMatch(/sudah ada/);
	});
});

describe("domainError", () => {
	it("memetakan kode yang dikenal dan mengabaikan sisanya", () => {
		expect(domainError(new Error("CAMP_FULL"))).toEqual(DOMAIN_ERRORS.CAMP_FULL);
		expect(domainError(new Error("toString"))).toBeNull();
		expect(domainError(new Error("TIDAK_ADA"))).toBeNull();
		expect(domainError("CAMP_FULL")).toBeNull();
	});

	it("P2034_EXHAUSTED selalu 409", () => {
		expect(DOMAIN_ERRORS.P2034_EXHAUSTED.status).toBe(409);
	});
});

describe("handleRouteError", () => {
	afterEach(() => vi.restoreAllMocks());

	it("JSON rusak → 400", async () => {
		expect((await body(handleRouteError(new InvalidJsonError(), options))).status).toBe(400);
	});

	it("auth → 401/403 dengan pesan forbidden kustom", async () => {
		expect((await body(handleRouteError(new Error("UNAUTHORIZED"), options))).status).toBe(401);
		const forbidden = await body(handleRouteError(new Error("FORBIDDEN"), { ...options, forbiddenMessage: "Khusus admin." }));
		expect(forbidden).toMatchObject({ status: 403, message: "Khusus admin." });
	});

	it("P2034 dan P2034_EXHAUSTED → 409", async () => {
		expect((await body(handleRouteError(knownError("P2034"), options))).status).toBe(409);
		expect((await body(handleRouteError(new Error("P2034_EXHAUSTED"), options))).status).toBe(409);
	});

	it("error domain memakai status peta, pesan bisa di-override per route", async () => {
		expect(await body(handleRouteError(new Error("CAMP_NOT_FOUND"), options))).toMatchObject({ status: 404, message: DOMAIN_ERRORS.CAMP_NOT_FOUND.message });
		const custom = await body(handleRouteError(new Error("CAMP_NOT_ACTIVE"), { ...options, messages: { CAMP_NOT_ACTIVE: "Posko tutup." } }));
		expect(custom).toMatchObject({ status: 409, message: "Posko tutup." });
	});

	it("P2002 → 409 per constraint; P2003 hanya bila pesan FK diberikan", async () => {
		expect(await body(handleRouteError(adapterUnique("Camp_managerId_key"), options))).toMatchObject({ status: 409, message: "Manager tersebut sudah memimpin posko lain." });
		expect(await body(handleRouteError(knownError("P2003"), { ...options, foreignKeyMessage: "Masih dipakai." }))).toMatchObject({ status: 409, message: "Masih dipakai." });

		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		expect((await body(handleRouteError(knownError("P2003"), options))).status).toBe(500);
		expect(log).toHaveBeenCalledWith("TEST_ERROR", expect.anything());
	});

	it("error tak dikenal → 500 fallback + log", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await body(handleRouteError(new Error("boom"), options))).toMatchObject({ status: 500, message: "Gagal." });
		expect(log).toHaveBeenCalledOnce();
	});
});
