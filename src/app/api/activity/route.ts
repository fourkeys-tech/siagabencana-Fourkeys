import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

type ActivityUser = Awaited<ReturnType<typeof requireAuth>>;

// Admin melihat semua; manager satu posko; kepala divisi satu posko & divisi; petugas hanya miliknya.
function activityWhere(user: ActivityUser): Prisma.AuditLogWhereInput | undefined {
	if (user.role === "SUPER_ADMIN") return undefined;
	if (user.role === "MANAGER" && user.campId) {
		return { OR: [{ userId: user.id }, { user: { campId: user.campId } }] };
	}
	if (user.role === "DIVISION_HEAD" && user.campId && user.division) {
		return { OR: [{ userId: user.id }, { user: { campId: user.campId, division: user.division } }] };
	}
	return { userId: user.id };
}

export async function GET(request: Request) {
	try {
		const user = await requireAuth();
		const url = new URL(request.url);
		const params = parsePagination(url, 50, 100);
		const skip = (params.page! - 1) * params.limit!;
		const where = activityWhere(user);

		const [logs, total] = await Promise.all([
			prisma.auditLog.findMany({
				where,
				skip,
				take: params.limit,
				orderBy: { createdAt: "desc" },
				include: { user: { select: { id: true, name: true, email: true, role: true, division: true } } },
			}),
			prisma.auditLog.count({ where }),
		]);

		return paginatedResponse(logs, total, params);
	} catch (error) {
		if (isAuthError(error)) return authError(error);
		console.error("GET_AUDIT_LOGS_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal mengambil riwayat aktivitas." }, { status: 500 });
	}
}
