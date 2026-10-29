import { NextResponse } from "next/server";
import { authError, isAuthError, requireRole } from "@/lib/auth/guard";

export async function GET() {
	try {
		await requireRole("SUPER_ADMIN");
		return NextResponse.json({
			success: true,
			data: {
				application: "Siaga Bencana",
				version: process.env.npm_package_version ?? "0.1.0",
				nodeEnvironment: process.env.NODE_ENV ?? "development",
				databaseConfigured: Boolean(process.env.DATABASE_URL),
				googleSheetsConfigured: Boolean(
					process.env.GOOGLE_SPREADSHEET_ID &&
					process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
				),
			},
		});
	} catch (error) {
		if (isAuthError(error)) return authError(error, "Hanya Super Admin yang dapat melihat informasi sistem.");
		return NextResponse.json({ success: false, message: "Gagal mengambil informasi sistem." }, { status: 500 });
	}
}

