import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
	const startedAt = Date.now();
	try {
		await prisma.$queryRaw`SELECT 1`;
		return NextResponse.json({
			status: "healthy",
			service: "siaga-bencana",
			database: "ok",
			uptime: process.uptime(),
			responseTimeMs: Date.now() - startedAt,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("HEALTH_CHECK_ERROR", error);
		return NextResponse.json(
			{
				status: "unhealthy",
				service: "siaga-bencana",
				database: "down",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			},
			{ status: 503 },
		);
	}
}