import { describe, expect, it } from "vitest";
import { canAssignRole, canManageCamp, canManageDivision, getAccessibleCampWhere } from "../src/lib/auth/guard";
import { canAccessPath, isProtectedPath, safeReturnTo } from "../src/lib/navigation";
import { enumLabel } from "../src/lib/labels";
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

		it("division menu hanya untuk divisi yang sesuai", () => {
			const shelterOfficer: SessionUser = { ...user, division: "SHELTER" };
			expect(canAccessPath("/logistik", shelterOfficer)).toBe(false);
			expect(canAccessPath("/distribusi", shelterOfficer)).toBe(false);
			expect(canAccessPath("/shelter", shelterOfficer)).toBe(true);
			expect(canAccessPath("/logistik", user)).toBe(true);
			expect(canAccessPath("/distribusi", user)).toBe(true);
		});

		it("Manager & Super Admin melihat semua menu divisi", () => {
			const manager: SessionUser = { ...user, role: "MANAGER", division: null };
			const admin: SessionUser = { ...user, role: "SUPER_ADMIN", division: null, campId: null };
			for (const path of ["/logistik", "/shelter", "/pengungsi", "/distribusi", "/kelola-posko"]) {
				expect(canAccessPath(path, manager)).toBe(true);
				expect(canAccessPath(path, admin)).toBe(true);
			}
		});

		it("Kelola Posko ditolak untuk Field Officer", () => {
			expect(canAccessPath("/kelola-posko", user)).toBe(false);
			expect(canAccessPath("/kelola-posko/camp1", user)).toBe(false);
		});
	});

	describe("canAssignRole", () => {
		it("SUPER_ADMIN can assign any role", () => {
			expect(canAssignRole({ role: "SUPER_ADMIN" }, "SUPER_ADMIN")).toBe(true);
			expect(canAssignRole({ role: "SUPER_ADMIN" }, "MANAGER")).toBe(true);
			expect(canAssignRole({ role: "SUPER_ADMIN" }, "DIVISION_HEAD")).toBe(true);
			expect(canAssignRole({ role: "SUPER_ADMIN" }, "FIELD_OFFICER")).toBe(true);
		});

		it("MANAGER can only assign DIVISION_HEAD or FIELD_OFFICER", () => {
			expect(canAssignRole({ role: "MANAGER" }, "SUPER_ADMIN")).toBe(false);
			expect(canAssignRole({ role: "MANAGER" }, "MANAGER")).toBe(false);
			expect(canAssignRole({ role: "MANAGER" }, "DIVISION_HEAD")).toBe(true);
			expect(canAssignRole({ role: "MANAGER" }, "FIELD_OFFICER")).toBe(true);
		});

		it("other roles cannot assign any role", () => {
			expect(canAssignRole({ role: "DIVISION_HEAD" }, "FIELD_OFFICER")).toBe(false);
			expect(canAssignRole({ role: "FIELD_OFFICER" }, "FIELD_OFFICER")).toBe(false);
		});
	});

	describe("safeReturnTo", () => {
		it("allows valid relative paths", () => {
			expect(safeReturnTo("/dashboard")).toBe("/dashboard");
			expect(safeReturnTo("/logistik/123")).toBe("/logistik/123");
		});

		it("rejects open-redirect vectors and protocol-relative paths", () => {
			expect(safeReturnTo("//evil.com")).toBe("/dashboard");
			expect(safeReturnTo("/\\evil.com")).toBe("/dashboard");
			expect(safeReturnTo("https://evil.com")).toBe("/dashboard");
			expect(safeReturnTo("javascript:alert(1)")).toBe("/dashboard");
			expect(safeReturnTo(null)).toBe("/dashboard");
			expect(safeReturnTo(undefined)).toBe("/dashboard");
			expect(safeReturnTo("")).toBe("/dashboard");
		});

		it("uses custom fallback when provided", () => {
			expect(safeReturnTo("//evil.com", "/public")).toBe("/public");
		});
	});

	describe("enumLabel", () => {
		it("translates roles, statuses, and inventory movement types", () => {
			expect(enumLabel("SUPER_ADMIN")).toBe("Super Admin");
			expect(enumLabel("MANAGER")).toBe("Manager Posko");
			expect(enumLabel("ACTIVE")).toBe("Aktif");
			expect(enumLabel("CLOSED")).toBe("Ditutup");
			expect(enumLabel("RECEIPT")).toBe("Stok Masuk");
			expect(enumLabel("DISPOSE")).toBe("Dibuang");
			expect(enumLabel(null)).toBe("-");
			expect(enumLabel("UNKNOWN_VAL", "Kustom")).toBe("Kustom");
		});
	});
});