import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/api-errors";
import { assertCampActive } from "@/lib/camps";
import { readJson } from "@/lib/http";
import { runSerializable } from "@/lib/transaction";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
	try {
		const admin = await requireRole("SUPER_ADMIN");
		const { id: campId } = await params;
		const body = await readJson(request);
		const managerId = body.userId ? String(body.userId) : null;

		// Status posko dan role/penugasan manager dicek dalam transaksi yang sama dengan update,
		// supaya perubahan paralel (posko ditutup, user dipindah) tidak lolos di antara cek dan tulis.
		const updatedCamp = await runSerializable(async (tx) => {
			await assertCampActive(campId, tx);
			if (managerId) {
				const manager = await tx.user.findUnique({ where: { id: managerId }, select: { role: true, campId: true } });
				if (!manager || manager.role !== "MANAGER" || manager.campId !== campId) throw new Error("INVALID_MANAGER_ASSIGNMENT");
			}
			return tx.camp.update({ where: { id: campId }, data: { managerId }, select: { id: true, name: true, manager: { select: { id: true, name: true } } } });
		});

		await writeAuditLog({ userId: admin.id, action: managerId ? "ASSIGN_MANAGER" : "UNASSIGN_MANAGER", entity: "Camp", entityId: campId, details: managerId ? { managerId } : undefined });
		return NextResponse.json({ success: true, message: managerId ? "Manager posko ditetapkan." : "Manager posko dilepas.", data: updatedCamp });
	} catch (error) {
		// Camp.managerId unik: manager yang sudah memimpin posko lain → P2002 → 409.
		return handleRouteError(error, {
			context: "ASSIGN_CAMP_MANAGER_ERROR",
			fallback: "Gagal menetapkan manager posko.",
			forbiddenMessage: "Hanya Super Admin yang dapat menetapkan manager.",
		});
	}
}
