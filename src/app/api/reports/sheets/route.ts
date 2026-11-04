import { getAccessibleCampWhere, requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { isGoogleServiceAccountConfigured } from "@/lib/env";
import { readJson } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit";
import { enumLabel } from "@/lib/labels";
import { getServiceAccountEmail, writeReportToGoogleSheet, type ReportSheetRow } from "@/lib/google-sheets";
import { buildReportData, formatDateTimeWIB, parseReportDate } from "@/lib/reports";
import { sheetsErrorInfo } from "@/lib/spreadsheet";

export async function POST(request: Request) {
	try {
		const user = await requireRole("SUPER_ADMIN", "MANAGER");

		if (!isGoogleServiceAccountConfigured()) {
			return fail("Service account Google belum dikonfigurasi di server. Hubungi administrator.", 503);
		}

		const owner = await prisma.user.findUnique({ where: { id: user.id }, select: { reportSpreadsheetId: true } });
		const spreadsheetId = owner?.reportSpreadsheetId;
		if (!spreadsheetId) {
			return fail("Spreadsheet tujuan belum diatur. Atur di menu Pengaturan → Ekspor Google Sheets.", 400);
		}

		const body = await readJson(request);
		const fromValue = typeof body.from === "string" ? body.from : null;
		const toValue = typeof body.to === "string" ? body.to : null;

		const from = parseReportDate(fromValue, false);
		const to = parseReportDate(toValue, true);

		if (!from || !to || from > to) {
			return fail("Periode laporan tidak valid (format: YYYY-MM-DD).", 400);
		}

		const campWhere = getAccessibleCampWhere(user);

		const report = await buildReportData({
			prisma,
			campWhere,
			canViewEvacueeNames: true,
			from,
			to,
		});

		const rows: ReportSheetRow[] = [
			["Periode Laporan", `${report.period.fromFormatted} s/d ${report.period.toFormatted}`],
			["Waktu Ekspor (WIB)", formatDateTimeWIB(new Date())],
			[],
			["RINGKASAN OPERASIONAL"],
			["Indikator", "Nilai", "Kategori"],
			["Total Posko Aktif", report.summary.totalCamps, "Snapshot Saat Ini"],
			["Total Kapasitas (Jiwa)", report.summary.totalCapacity, "Snapshot Saat Ini"],
			["Total Penghuni Saat Ini (Jiwa)", report.summary.totalOccupants, "Snapshot Saat Ini"],
			["Tingkat Okupansi (%)", `${report.summary.occupancyPercentage}%`, "Snapshot Saat Ini"],
			["Logistik Bermasalah (Jenis)", report.summary.criticalLogistics, "Snapshot Saat Ini"],
			["Fasilitas Bermasalah", report.summary.damagedFacilities, "Snapshot Saat Ini"],
			["Pengungsi Tiba (KK)", report.summary.arrivedEvacueeRecords, "Dalam Periode"],
			["Pengungsi Tiba (Jiwa)", report.summary.arrivedEvacueeFamilies, "Dalam Periode"],
			["Pengungsi Keluar (KK)", report.summary.departedEvacueeRecords, "Dalam Periode"],
			["Pengungsi Keluar (Jiwa)", report.summary.departedEvacueeFamilies, "Dalam Periode"],
			["Pengungsi Kebutuhan Khusus", report.summary.specialNeeds, "Dalam Periode"],
			["Total Distribusi Terkirim", report.summary.distributionsCount, "Dalam Periode"],
			["Distribusi Selesai Diterima", report.summary.receivedDistributionsCount, "Dalam Periode"],
			["Total Transaksi Mutasi Stok", report.summary.totalMovementsCount, "Dalam Periode"],
			[],
			["STATUS POSKO"],
			["Posko", "Status", "Kapasitas", "Penghuni", "Okupansi", "Logistik Bermasalah", "Fasilitas Bermasalah"],
			...report.camps.map((camp) => [
				camp.name,
				enumLabel(camp.status),
				camp.maxCapacity,
				camp.currentOccupants,
				`${camp.occupancyPercentage}%`,
				camp.problemLogistics,
				camp.damagedFacilities,
			]),
			[],
			["MUTASI STOK LOGISTIK"],
			["Posko", "Barang", "Masuk (Penerimaan)", "Masuk (Distribusi)", "Total Masuk", "Keluar (Distribusi)", "Rusak", "Hilang", "Dibuang", "Dipulihkan", "Satuan", "Total Transaksi"],
			...(report.stockMovements.length === 0
				? [["(Tidak ada pergerakan stok dalam periode ini)"]]
				: report.stockMovements.map((row) => [
					row.campName,
					row.itemName,
					row.receiptQty,
					row.distributionInQty,
					row.totalInQty,
					row.distributionOutQty,
					row.damagedQty,
					row.lossQty,
					row.disposedQty,
					row.restoredQty,
					row.unit,
					row.movementCount,
				])),
			[],
			["LOGISTIK SAAT INI"],
			["Barang", "Posko", "Jumlah", "Satuan", "Saldo Dasar", "Satuan Dasar", "Status Konversi", "Status"],
			...report.logistics.map((item) => [
				item.itemName,
				item.camp.name,
				item.quantity,
				item.unit,
				item.quantityBase,
				item.baseUnit,
				item.conversionStatus === "NEEDS_REVIEW" ? "Perlu Verifikasi" : "Terverifikasi",
				enumLabel(item.status),
			]),
			[],
			["DISTRIBUSI LOGISTIK"],
			["Waktu Dibuat (WIB)", "Barang", "Posko Asal", "Posko Tujuan", "Jumlah", "Satuan", "Status", "Waktu Kirim (WIB)", "Waktu Terima (WIB)"],
			...(report.distributions.length === 0
				? [["(Tidak ada distribusi dalam periode ini)"]]
				: report.distributions.map((distribution) => [
					distribution.createdAtFormatted,
					distribution.itemName,
					distribution.sourceCamp.name,
					distribution.destinationCamp.name,
					distribution.quantity,
					distribution.unit,
					enumLabel(distribution.status),
					distribution.shippedAt ? formatDateTimeWIB(distribution.shippedAt) : "-",
					distribution.receivedAt ? formatDateTimeWIB(distribution.receivedAt) : "-",
				])),
			[],
			["FASILITAS POSKO"],
			["Waktu Laporan (WIB)", "Posko", "Fasilitas", "Status", "Keterangan"],
			...(report.facilities.length === 0
				? [["(Tidak ada laporan fasilitas dalam periode ini)"]]
				: report.facilities.map((facility) => [
					facility.createdAtFormatted,
					facility.camp.name,
					facility.facilityName,
					enumLabel(facility.status),
					facility.description,
				])),
			[],
			["AKTIVITAS PENGUNGSI"],
			["Nama", "Posko", "Jumlah Keluarga (Jiwa)", "Kebutuhan Khusus", "Waktu Tiba (WIB)", "Waktu Keluar (WIB)"],
			...(report.evacuees.length === 0
				? [["(Tidak ada pengungsi tercatat dalam periode ini)"]]
				: report.evacuees.map((record) => [
					record.name,
					record.camp.name,
					record.totalFamily,
					record.hasSpecialNeeds ? "Ya" : "Tidak",
					record.arrivedAtFormatted,
					record.departedAtFormatted,
				])),
		];

		const sectionRows: number[] = [];
		const headerRows: number[] = [];
		const SECTION_TITLES = new Set([
			"RINGKASAN OPERASIONAL",
			"STATUS POSKO",
			"MUTASI STOK LOGISTIK",
			"LOGISTIK SAAT INI",
			"DISTRIBUSI LOGISTIK",
			"FASILITAS POSKO",
			"AKTIVITAS PENGUNGSI",
		]);

		for (let index = 0; index < rows.length; index += 1) {
			const firstCell = rows[index]?.[0];
			if (typeof firstCell === "string" && SECTION_TITLES.has(firstCell)) {
				sectionRows.push(index);
			}
			if (
				typeof firstCell === "string" &&
				["Indikator", "Posko", "Waktu Dibuat (WIB)", "Waktu Laporan (WIB)", "Nama", "Barang"].includes(firstCell)
			) {
				headerRows.push(index);
			}
		}

		const result = await writeReportToGoogleSheet(
			spreadsheetId,
			rows,
			`LAPORAN SIAGA BENCANA | ${report.period.fromFormatted} - ${report.period.toFormatted}`,
			{
				tabTitle: `Laporan ${report.period.fromFormatted}_${report.period.toFormatted}`,
				sectionRows,
				headerRows,
				columnCount: 12,
			},
		);

		await writeAuditLog({
			userId: user.id,
			action: "EXPORT",
			entity: "Report",
			details: {
				target: "GOOGLE_SHEETS",
				spreadsheetId,
				from: report.period.from,
				to: report.period.to,
				sheetTitle: result.sheetTitle,
			},
		});

		return ok(result, "Laporan berhasil diekspor ke Google Sheets.");
	} catch (error) {
		const info = sheetsErrorInfo(error, getServiceAccountEmail());
		if (info) {
			console.warn("EXPORT_REPORT_SHEETS_GOOGLE_ERROR", info.status, error instanceof Error ? error.message : error);
			return fail(info.message, info.status);
		}
		return handleRouteError(error, {
			context: "EXPORT_REPORT_SHEETS_ERROR",
			fallback: "Gagal mengirim laporan ke Google Sheets.",
			forbiddenMessage: "Hanya Super Admin atau Manager yang dapat mengekspor laporan.",
		});
	}
}
