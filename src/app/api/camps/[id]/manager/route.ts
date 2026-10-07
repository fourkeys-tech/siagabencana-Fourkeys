import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireRole } from "@/lib/auth/guard";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
	try {
		const admin = await requireRole("SUPER_ADMIN");
		const { id: campId } = await params;
		const body = await request.json() as Record<string, unknown>;
		const managerId = body.userId ? String(body.userId) : null;
		const camp = await prisma.camp.findUnique({ where: { id: campId }, select: { id: true } });
		if (!camp) return NextResponse.json({ success: false, message: "Posko tidak ditemukan." }, { status: 404 });

		if (managerId) {
			const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true, role: true, campId: true } });
			if (!manager || manager.role !== "MANAGER" || manager.campId !== campId) {
				return NextResponse.json({ success: false, message: "Pilih akun Manager yang sudah ditugaskan ke posko ini." }, { status: 400 });
			}
		}

		const updatedCamp = await prisma.camp.update({ where: { id: campId }, data: { managerId }, select: { id: true, name: true, manager: { select: { id: true, name: true } } } });
		await prisma.auditLog.create({ data: { userId: admin.id, action: managerId ? "ASSIGN_MANAGER" : "UNASSIGN_MANAGER", entity: "Camp", entityId: campId, details: managerId ? JSON.stringify({ managerId }) : null } });
		return NextResponse.json({ success: true, message: managerId ? "Manager posko ditetapkan." : "Manager posko dilepas.", data: updatedCamp });
	} catch (error) {
		if (isAuthError(error)) return authError(error, "Hanya Super Admin yang dapat menetapkan manager.");
		console.error("ASSIGN_CAMP_MANAGER_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal menetapkan manager posko." }, { status: 500 });
	}
}
