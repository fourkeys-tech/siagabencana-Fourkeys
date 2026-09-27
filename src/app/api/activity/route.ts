import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";

export async function GET(request: Request) {
	try {
		const user = await requireAuth();
		const url = new URL(request.url);
		const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
		const logs = await prisma.auditLog.findMany({
			take: limit,
			orderBy: { createdAt: "desc" },
			include: { user: { select: { id: true, name: true, email: true, role: true, division: true } } },
			where: user.role === "SUPER_ADMIN" ? undefined : { userId: user.id },
		});
		return NextResponse.json({ success: true, data: logs });
	} catch (error) {
		if (isAuthError(error)) return authError(error);
		console.error("GET_AUDIT_LOGS_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil riwayat aktivitas." }, { status: 500 });
	}
}
