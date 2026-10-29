import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireRole } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { assertCampActive, campError } from "@/lib/camps";
import { invalidJsonResponse, isInvalidJson, readJson } from "@/lib/http";
import { DivisionType } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };
const validDivisions: DivisionType[] = ["LOGISTICS", "SHELTER", "DATA_REGISTRATION"];

export async function PUT(request: Request, { params }: Params) {
	try {
		const admin = await requireRole("SUPER_ADMIN");
		const { id: campId } = await params;
		const body = await readJson(request);
		const division = String(body.division ?? "") as DivisionType;
		const userId = body.userId ? String(body.userId) : null;
		if (!validDivisions.includes(division)) return NextResponse.json({ success: false, message: "Divisi tidak valid." }, { status: 400 });

		await assertCampActive(campId);

		if (userId) {
			const head = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, division: true, campId: true } });
			if (!head || head.role !== "DIVISION_HEAD" || head.division !== division || head.campId !== campId) {
				return NextResponse.json({ success: false, message: "Pilih ketua divisi yang sesuai posko dan divisi." }, { status: 400 });
			}
			await prisma.campDivisionHead.upsert({ where: { campId_division: { campId, division } }, create: { campId, division, userId }, update: { userId } });
		} else {
			await prisma.campDivisionHead.deleteMany({ where: { campId, division } });
		}
		await writeAuditLog({ userId: admin.id, action: userId ? "ASSIGN_DIVISION_HEAD" : "UNASSIGN_DIVISION_HEAD", entity: "CampDivisionHead", entityId: campId, details: { division, userId } });
		return NextResponse.json({ success: true, message: userId ? "Ketua divisi ditetapkan." : "Ketua divisi dilepas." });
	} catch (error) {
		if (isInvalidJson(error)) return invalidJsonResponse();
		const knownCampError = campError(error);
		if (knownCampError) return NextResponse.json({ success: false, message: knownCampError.message }, { status: knownCampError.status });
		if (isAuthError(error)) return authError(error, "Hanya Super Admin yang dapat menetapkan ketua divisi.");
		console.error("ASSIGN_DIVISION_HEAD_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal menetapkan ketua divisi." }, { status: 500 });
	}
}

