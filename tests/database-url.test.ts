import { describe, expect, it } from "vitest";
import { withExplicitSslMode } from "@/lib/env";

describe("withExplicitSslMode", () => {
	it("require/prefer/verify-ca → verify-full (perilaku pg 8.x yang sama, tanpa warning)", () => {
		expect(withExplicitSslMode("postgres://u:p@db.host:5432/db?sslmode=require")).toBe("postgres://u:p@db.host:5432/db?sslmode=verify-full");
		expect(withExplicitSslMode("postgres://u:p@h/db?sslmode=prefer&pool=1")).toBe("postgres://u:p@h/db?sslmode=verify-full&pool=1");
		expect(withExplicitSslMode("postgres://u:p@h/db?a=1&sslmode=verify-ca")).toBe("postgres://u:p@h/db?a=1&sslmode=verify-full");
	});

	it("tidak mengubah mode lain, URL tanpa sslmode, atau password yang memuat teks serupa", () => {
		for (const url of [
			"postgres://u:p@h/db?sslmode=verify-full",
			"postgres://u:p@h/db?sslmode=disable",
			"postgresql://siaga:siaga@localhost:5433/siaga_test",
			"postgres://u:sslmode=require@h/db",
			"postgres://u:p@h/db?uselibpqcompat=true&sslmode=requirex",
		]) {
			expect(withExplicitSslMode(url)).toBe(url);
		}
	});
});
