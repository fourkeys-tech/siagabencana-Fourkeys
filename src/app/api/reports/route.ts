import { canManageDivision, getAccessibleCampWhere, requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { isGoogleServiceAccountConfigured } from "@/lib/env";
import { fail, ok } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { buildReportCsv, buildReportData, parseReportDate } from "@/lib/reports";

export async function GET(request: Request) {
	try {
		const user = await requireAuth();
		const url = new URL(request.url);

		const fromParam = url.searchParams.get("from");
		const toParam = url.searchParams.get("to");
		const format = url.searchParams.get("format")?.toLowerCase() ?? "json";

		const from = parseReportDate(fromParam, false);
		const to = parseReportDate(toParam, true);

		if (url.searchParams.has("from") && !from) {
			return fail("Tanggal mulai tidak valid (format: YYYY-MM-DD).", 400);
		}

		if (url.searchParams.has("to") && !to) {
			return fail("Tanggal akhir tidak valid (format: YYYY-MM-DD).", 400);
		}

		if (from && to && from > to) {
			return fail("Tanggal mulai tidak boleh melewati tanggal akhir.", 400);
		}

		const campWhere = getAccessibleCampWhere(user);
		const canViewEvacueeNames = user.role === "SUPER_ADMIN"
			|| user.role === "MANAGER"
			|| Boolean(user.campId && canManageDivision(user, "DATA_REGISTRATION", user.campId));

		const hasDateFilter = url.searchParams.has("from") || url.searchParams.has("to");
		// Default 30 hari terakhir bila tidak ada parameter tanggal
		const effectiveFrom = from ?? (hasDateFilter ? null : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
		const effectiveTo = to ?? (hasDateFilter ? null : new Date());

		const canExportSheets = format !== "csv" && (user.role === "SUPER_ADMIN" || user.role === "MANAGER");
		const [report, sheetsOwner] = await Promise.all([
			buildReportData({
				prisma,
				campWhere,
				canViewEvacueeNames,
				from: effectiveFrom,
				to: effectiveTo,
			}),
			canExportSheets
				? prisma.user.findUnique({ where: { id: user.id }, select: { reportSpreadsheetId: true } })
				: null,
		]);

		if (format === "csv") {
			const csv = buildReportCsv(report);
			const filename = `laporan-siagabencana-${report.period.fromFormatted}-sd-${report.period.toFormatted}.csv`;
			return new Response(csv, {
				status: 200,
				headers: {
					"Content-Type": "text/csv; charset=utf-8",
					"Content-Disposition": `attachment; filename="${filename}"`,
					"Cache-Control": "no-store",
				},
			});
		}

		return ok({
			...report,
			// null = role ini tidak bisa ekspor ke Sheets (tombol disembunyikan).
			sheets: canExportSheets
				? {
					serviceAccountConfigured: isGoogleServiceAccountConfigured(),
					spreadsheetConfigured: Boolean(sheetsOwner?.reportSpreadsheetId),
				}
				: null,
		});
	} catch (error) {
		return handleRouteError(error, {
			context: "GET_REPORTS_ERROR",
			fallback: "Gagal mengambil data laporan.",
		});
	}
}
