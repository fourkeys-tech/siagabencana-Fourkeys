import type { DivisionType, Role } from "@prisma/client";
import { NextResponse } from "next/server";

export async function requireAuth() {
	const { getCurrentUser } = await import("@/lib/auth/session");
	const user = await getCurrentUser();
	if (!user) throw new Error("UNAUTHORIZED");
	return user;
}

export async function requireRole(...roles: Role[]) {
	const user = await requireAuth();
	if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
	return user;
}

export async function requireDivision(division: DivisionType) {
	const user = await requireAuth();
	if (user.role === "SUPER_ADMIN" || user.division === division) return user;
	throw new Error("FORBIDDEN");
}

export async function requireCampAccess(campId: string) {
	const user = await requireAuth();
	if (user.role === "SUPER_ADMIN" || user.campId === campId) return user;
	throw new Error("FORBIDDEN");
}

export function canManageDivision(
	user: { role: Role; division: DivisionType | null; campId: string | null },
	division: DivisionType,
	campId: string,
) {
	if (user.role === "SUPER_ADMIN") return true;
	if (!user.campId || user.campId !== campId) return false;
	if (user.role === "MANAGER") return user.division === null || user.division === division;
	return (user.role === "DIVISION_HEAD" || user.role === "FIELD_OFFICER") && user.division === division;
}

export function canManageCamp(
	user: { role: Role; campId: string | null },
	campId: string,
) {
	return user.role === "SUPER_ADMIN" || Boolean(user.campId && user.campId === campId);
}

/**
 * Mengembalikan filter Prisma untuk camp yang dapat diakses oleh user.
 * SUPER_ADMIN dapat mengakses semua camp (undefined).
 * Role lain hanya dapat mengakses camp tempat mereka ditugaskan.
 */
export function getAccessibleCampWhere(user: { role: Role; campId: string | null }) {
	if (user.role === "SUPER_ADMIN") return {};
	return { id: user.campId ?? "" };
}

export function isAuthError(error: unknown): error is Error {
	return error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN");
}

export function authError(error: unknown, forbiddenMessage = "Forbidden") {
	if (error instanceof Error) {
		if (error.message === "UNAUTHORIZED") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
		if (error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: forbiddenMessage }, { status: 403 });
	}
	return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
}
