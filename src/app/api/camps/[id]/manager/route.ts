import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireRole } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { assertCampActive, campError } from "@/lib/camps";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
	try {
		const admin = await requireRole("SUPER_ADMIN");
		const { id: campId } = await params;
		const body = await readJson(request);
		const managerId = body.userId ? String(body.userId) : null;

		await assertCampActive(campId);

		if (managerId) {
			const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true, role: true, campId: true } });
			if (!manager || manager.role !== "MANAGER" || manager.campId !== campId) {
				return NextResponse.json({ success: false, message: "Pilih akun Manager yang sudah ditugaskan ke posko ini." }, { status: 400 });
			}
		}

		const updatedCamp = await prisma.camp.update({ where: { id: campId }, data: { managerId }, select: { id: true, name: true, manager: { select: { id: true, name: true } } } });
		await writeAuditLog({ userId: admin.id, action: managerId ? "ASSIGN_MANAGER" : "UNASSIGN_MANAGER", entity: "Camp", entityId: campId, details: managerId ? { managerId } : undefined });
		return NextResponse.json({ success: true, message: managerId ? "Manager posko ditetapkan." : "Manager posko dilepas.", data: updatedCamp });
	} catch (error) {
		if (isInvalidJson(error)) return invalidJsonResponse();
		const knownCampError = campError(error);
		if (knownCampError) return NextResponse.json({ success: false, message: knownCampError.message }, { status: knownCampError.status });
		if (isAuthError(error)) return authError(error, "Hanya Super Admin yang dapat menetapkan manager.");
		console.error("ASSIGN_CAMP_MANAGER_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal menetapkan manager posko." }, { status: 500 });
	}
}

