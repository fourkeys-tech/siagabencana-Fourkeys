import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
	try {
		const cronSecret = process.env.CRON_SECRET;
		if (cronSecret) {
			const authHeader = request.headers.get("authorization");
			if (authHeader !== `Bearer ${cronSecret}`) {
				return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
			}
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
