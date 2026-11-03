import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCronSecret, isProduction } from "@/lib/env";

const digest = (value: string) => createHash("sha256").update(value).digest();

// Vercel Cron mengirim "Authorization: Bearer $CRON_SECRET". Fail-closed: tanpa secret,
// endpoint hanya terbuka di development lokal.
function isAuthorizedCron(request: Request) {
	const secret = getCronSecret();
	if (!secret) return !isProduction();
	const header = request.headers.get("authorization") ?? "";
	return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
	try {
		if (!isAuthorizedCron(request)) {
			if (!getCronSecret()) console.error("CRON_CLEANUP_ERROR", "CRON_SECRET belum di-set; cron ditolak.");
			return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
		}

		const now = new Date();
		const result = await prisma.session.deleteMany({
			where: {
				expiresAt: { lt: now },
			},
		});

		return NextResponse.json({
			success: true,
			message: "Pembersihan sesi kedaluwarsa berhasil.",
			deletedCount: result.count,
			cleanedAt: now.toISOString(),
		});
	} catch (error) {
		console.error("CRON_CLEANUP_ERROR", error);
		return NextResponse.json({ success: false, message: "Gagal membersihkan sesi." }, { status: 500 });
	}
}
