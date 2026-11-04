import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { readJson } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit";
import { isGoogleServiceAccountConfigured } from "@/lib/env";
import { getServiceAccountEmail, verifySpreadsheetAccess } from "@/lib/google-sheets";
import { parseSpreadsheetId, sheetsErrorInfo, spreadsheetUrl } from "@/lib/spreadsheet";

const ROLES = ["SUPER_ADMIN", "MANAGER"] as const;
const FORBIDDEN = "Hanya Super Admin dan Manager yang dapat mengatur ekspor laporan.";

async function settingsFor(userId: string) {
	const record = await prisma.user.findUnique({ where: { id: userId }, select: { reportSpreadsheetId: true } });
	const spreadsheetId = record?.reportSpreadsheetId ?? null;
	return {
		serviceAccountConfigured: isGoogleServiceAccountConfigured(),
		serviceAccountEmail: getServiceAccountEmail(),
		spreadsheetId,
		spreadsheetUrl: spreadsheetId ? spreadsheetUrl(spreadsheetId) : null,
	};
}

export async function GET() {
	try {
		const user = await requireRole(...ROLES);
		return ok(await settingsFor(user.id));
	} catch (error) {
		return handleRouteError(error, { context: "GET_REPORT_SETTINGS_ERROR", fallback: "Gagal mengambil pengaturan laporan.", forbiddenMessage: FORBIDDEN });
	}
}

/**
 * Simpan URL/ID spreadsheet milik akun ini. String kosong/null = hapus.
 * Akses tulis diverifikasi dulu bila service account tersedia, supaya kesalahan share ketahuan saat menyimpan,
 * bukan saat ekspor.
 */
export async function PUT(request: Request) {
	try {
		const user = await requireRole(...ROLES);
		const body = await readJson(request);
		const raw = typeof body.spreadsheet === "string" ? body.spreadsheet.trim() : "";

		let spreadsheetId: string | null = null;
		let title: string | null = null;

		if (raw) {
			spreadsheetId = parseSpreadsheetId(raw);
			if (!spreadsheetId) {
				return fail("URL atau ID spreadsheet tidak dikenali. Salin URL dari address bar saat spreadsheet terbuka (…/spreadsheets/d/…/edit).", 400);
			}

			if (isGoogleServiceAccountConfigured()) {
				try {
					title = (await verifySpreadsheetAccess(spreadsheetId)).title;
				} catch (error) {
					const info = sheetsErrorInfo(error, getServiceAccountEmail());
					if (info) return fail(info.message, info.status);
					throw error;
				}
			}
		}

		await prisma.user.update({ where: { id: user.id }, data: { reportSpreadsheetId: spreadsheetId } });
		await writeAuditLog({
			userId: user.id,
			action: "UPDATE",
			entity: "User",
			entityId: user.id,
			details: { reportSpreadsheetId: spreadsheetId },
		});

		const message = !spreadsheetId
			? "Spreadsheet laporan dihapus dari akun Anda."
			: title
				? `Terhubung ke spreadsheet "${title}".`
				: "Spreadsheet disimpan. Akses belum dapat diverifikasi karena service account belum dikonfigurasi di server.";

		return ok(await settingsFor(user.id), message);
	} catch (error) {
		return handleRouteError(error, { context: "UPDATE_REPORT_SETTINGS_ERROR", fallback: "Gagal menyimpan pengaturan laporan.", forbiddenMessage: FORBIDDEN });
	}
}
