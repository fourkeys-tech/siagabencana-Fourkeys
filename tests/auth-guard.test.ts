import { describe, expect, it } from "vitest";
import { canManageCamp, canManageDivision, getAccessibleCampWhere } from "../src/lib/auth/guard";
import { canAccessPath, isProtectedPath } from "../src/lib/navigation";
import type { SessionUser } from "../src/lib/navigation";

describe("auth guard", () => {
	describe("canManageCamp", () => {
		it("returns true for SUPER_ADMIN on any camp", () => {
			expect(canManageCamp({ role: "SUPER_ADMIN", campId: null }, "camp1")).toBe(true);
		});

		it("returns true when user's campId matches", () => {
			expect(canManageCamp({ role: "MANAGER", campId: "camp1" }, "camp1")).toBe(true);
		});

		it("returns false when user's campId does not match", () => {
			expect(canManageCamp({ role: "MANAGER", campId: "camp1" }, "camp2")).toBe(false);
		});

		it("returns false when user has no camp", () => {
			expect(canManageCamp({ role: "MANAGER", campId: null }, "camp1")).toBe(false);
		});
	});

	describe("canManageDivision", () => {
		it("SUPER_ADMIN can manage any division", () => {
			expect(canManageDivision({ role: "SUPER_ADMIN", division: null, campId: null }, "LOGISTICS", "camp1")).toBe(true);
		});

		it("MANAGER in same camp can manage own division", () => {
			expect(canManageDivision({ role: "MANAGER", division: null, campId: "camp1" }, "LOGISTICS", "camp1")).toBe(true);
		});

		it("DIVISION_HEAD can manage matching division in own camp", () => {
			expect(canManageDivision({ role: "DIVISION_HEAD", division: "LOGISTICS", campId: "camp1" }, "LOGISTICS", "camp1")).toBe(true);
		});

		it("DIVISION_HEAD cannot manage other division", () => {
			expect(canManageDivision({ role: "DIVISION_HEAD", division: "LOGISTICS", campId: "camp1" }, "SHELTER", "camp1")).toBe(false);
		});

		it("DIVISION_HEAD cannot manage other camp", () => {
			expect(canManageDivision({ role: "DIVISION_HEAD", division: "LOGISTICS", campId: "camp1" }, "LOGISTICS", "camp2")).toBe(false);
		});
	});

	describe("getAccessibleCampWhere", () => {
		it("returns empty filter for SUPER_ADMIN", () => {
			expect(getAccessibleCampWhere({ role: "SUPER_ADMIN", campId: null })).toEqual({});
		});

		it("filters by campId for non-admin", () => {
			expect(getAccessibleCampWhere({ role: "MANAGER", campId: "camp1" })).toEqual({ id: "camp1" });
		});

		it("returns empty id for non-admin without camp", () => {
			expect(getAccessibleCampWhere({ role: "FIELD_OFFICER", campId: null })).toEqual({ id: "" });
		});
	});

	describe("isProtectedPath", () => {
		it("matches parent path", () => {
			expect(isProtectedPath("/users")).toBe(true);
			expect(isProtectedPath("/logistik")).toBe(true);
		});

		it("matches dynamic subpath", () => {
			expect(isProtectedPath("/users/123")).toBe(true);
			expect(isProtectedPath("/logistik/abc/edit")).toBe(true);
			expect(isProtectedPath("/kelola-posko/camp-xyz")).toBe(true);
		});

		it("returns false for non-protected routes", () => {
			expect(isProtectedPath("/dashboard")).toBe(false);
			expect(isProtectedPath("/login")).toBe(false);
			expect(isProtectedPath("/public")).toBe(false);
			expect(isProtectedPath("/")).toBe(false);
		});
	});

	describe("canAccessPath", () => {
		const user: SessionUser = {
			id: "u1",
			name: "Test",
			email: "test@example.com",
			role: "FIELD_OFFICER",
			division: "LOGISTICS",
			campId: "camp1",
		};

		it("unauthenticated user cannot access protected dynamic route", () => {
			expect(canAccessPath("/users/abc/edit", null)).toBe(false);
		});

		it("authenticated user without parent permission cannot access dynamic route", () => {
			expect(canAccessPath("/users/abc/edit", user)).toBe(false);
		});

		it("unauthenticated user can access public routes", () => {
			expect(canAccessPath("/public", null)).toBe(true);
		});

		it("unauthenticated user redirected from login", () => {
			expect(canAccessPath("/login", null)).toBe(true);
		});

		it("user without correct role denied nav route", () => {
			const basicUser: SessionUser = { ...user, role: "FIELD_OFFICER", division: "SHELTER" };
			expect(canAccessPath("/users", basicUser)).toBe(false);
		});
	});
});