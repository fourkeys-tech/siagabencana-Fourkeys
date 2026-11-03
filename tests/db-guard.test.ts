import { describe, expect, it } from "vitest";
import { resolveTestDatabaseUrl } from "./integration/db-guard";

describe("resolveTestDatabaseUrl", () => {
	const local = "postgresql://u:p@localhost:5433/test";

	it("null bila TEST_DATABASE_URL kosong", () => {
		expect(resolveTestDatabaseUrl({})).toBeNull();
		expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: "  " })).toBeNull();
	});

	it("menerima DB lokal", () => {
		expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: local, DATABASE_URL: "postgresql://u:p@db.example.com/prod" })).toBe(local);
		expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/t" })).toBe("postgresql://u:p@127.0.0.1:5432/t");
	});

	it("menolak bila sama dengan DATABASE_URL", () => {
		expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: local, DATABASE_URL: local })).toThrow("tidak boleh sama");
	});

	it("menolak host remote kecuali di-opt-in", () => {
		const remote = "postgresql://u:p@db.example.com:5432/test";
		expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: remote })).toThrow("localhost");
		expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: remote, TEST_DATABASE_ALLOW_REMOTE: "1" })).toBe(remote);
	});

	it("menolak URL tidak valid", () => {
		expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: "bukan url" })).toThrow("bukan URL Postgres");
	});
});
