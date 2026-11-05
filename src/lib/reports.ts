import { PROBLEM_FACILITY_STATUSES, PROBLEM_LOGISTICS_STATUSES } from "@/lib/status-groups";
import { occupancyPercentage } from "@/lib/dashboard";
import {
	assessFacilities,
	FACILITY_CATEGORY_INFO,
	formatFacilityQuantity,
	sufficiencySummary,
	type OverallSufficiency,
} from "@/lib/shelter-standards";
import type { PrismaClient } from "@prisma/client";

export const WIB_TIMEZONE = "Asia/Jakarta";
export const WIB_OFFSET = "+07:00";

const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * Validasi dan parsing tanggal YYYY-MM-DD ke Date dengan asumsi zona waktu WIB (+07:00).
 * Menolak tanggal yang meluap (misal 2026-02-31).
 */
export function parseReportDate(value: string | null | undefined, endOfDay = false): Date | null {
	if (!value || typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!DATE_REGEX.test(trimmed)) return null;

	const [yearStr, monthStr, dayStr] = trimmed.split("-");
	const year = Number(yearStr);
	const month = Number(monthStr);
	const day = Number(dayStr);

	// Validasi hari maksimum dalam bulan (mencegah overflow seperti 31 Feb)
	const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
	if (day > daysInMonth) return null;

	const timePart = endOfDay ? "23:59:59.999" : "00:00:00.000";
	const isoString = `${trimmed}T${timePart}${WIB_OFFSET}`;
	const date = new Date(isoString);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format Date ke string YYYY-MM-DD dalam zona waktu Asia/Jakarta.
 */
export function formatDateWIB(date: Date | string | null | undefined): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "-";
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: WIB_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(d);
}

/**
 * Format Date ke tanggal dan jam lengkap dalam zona waktu Asia/Jakarta (DD/MM/YYYY HH:mm WIB).
 */
export function formatDateTimeWIB(date: Date | string | null | undefined): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "-";
	const parts = new Intl.DateTimeFormat("id-ID", {
		timeZone: WIB_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(d);

	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}.${get("minute")} WIB`;
}

/**
 * Tanggal hari ini dan awal bulan ini dalam WIB sebagai default input form.
 */
export function getDefaultReportPeriodWIB(now: Date = new Date()): { from: string; to: string } {
	const todayWIB = formatDateWIB(now);
	const [year, month] = todayWIB.split("-");
	return {
		from: `${year}-${month}-01`,
		to: todayWIB,
	};
}

export type StockMovementSummaryRow = {
	campId: string;
	campName: string;
	logisticsItemId: string;
	itemName: string;
	unit: string;
	baseUnit: string;
	receiptQty: number;
	distributionInQty: number;
	totalInQty: number;
	distributionOutQty: number;
	damagedQty: number;
	lossQty: number;
	disposedQty: number;
	restoredQty: number;
	movementCount: number;
};

export type ReportResult = {
	period: {
		from: string | null;
		to: string | null;
		fromFormatted: string;
		toFormatted: string;
	};
	canViewEvacueeNames: boolean;
	summary: {
		// Snapshot saat ini
		totalCamps: number;
		totalCapacity: number;
		totalOccupants: number;
		occupancyPercentage: number;
		criticalLogistics: number;
		damagedFacilities: number;
		/** Posko aktif yang minimal satu kategori fasilitasnya di bawah standar. */
		campsBelowStandard: number;
		// Dalam periode
		arrivedEvacueeRecords: number;
		arrivedEvacueeFamilies: number;
		departedEvacueeRecords: number;
		departedEvacueeFamilies: number;
		specialNeeds: number;
		distributionsCount: number;
		receivedDistributionsCount: number;
		shippedDistributionsCount: number;
		totalMovementsCount: number;
	};
	camps: Array<{
		id: string;
		name: string;
		status: string;
		maxCapacity: number;
		currentOccupants: number;
		occupancyPercentage: number;
		problemLogistics: number;
		damagedFacilities: number;
		facilitySufficiency: OverallSufficiency;
		facilitySummary: string;
	}>;
	evacuees: Array<{
		id: string;
		name: string;
		totalFamily: number;
		hasSpecialNeeds: boolean;
		arrivedAt: string;
		departedAt: string | null;
		arrivedAtFormatted: string;
		departedAtFormatted: string;
		camp: { id: string; name: string };
	}>;
	logistics: Array<{
		id: string;
		itemName: string;
		quantity: number;
		unit: string;
		quantityBase: number;
		baseUnit: string;
		conversionStatus: "CONFIGURED" | "NEEDS_REVIEW";
		status: string;
		camp: { id: string; name: string };
	}>;
	stockMovements: StockMovementSummaryRow[];
	/** Fasilitas yang masih bermasalah saat ini, ditambah yang dibuat/diperbarui dalam periode. */
	facilities: Array<{
		id: string;
		category: string;
		categoryLabel: string;
		facilityName: string;
		quantity: number;
		quantityFormatted: string;
		status: string;
		description: string;
		createdAt: string;
		createdAtFormatted: string;
		updatedAt: string;
		updatedAtFormatted: string;
		camp: { id: string; name: string };
	}>;
	distributions: Array<{
		id: string;
		itemName: string;
		quantity: number;
		unit: string;
		baseQuantity: number | null;
		baseUnit: string | null;
		conversionStatus: "CONFIGURED" | "NEEDS_REVIEW";
		status: string;
		createdAt: string;
		createdAtFormatted: string;
		shippedAt: string | null;
		receivedAt: string | null;
		sourceCamp: { id: string; name: string };
		destinationCamp: { id: string; name: string };
	}>;
};

export type BuildReportOptions = {
	prisma: PrismaClient;
	campWhere: { id?: string | { in: string[] } } | Record<string, never>;
	canViewEvacueeNames: boolean;
	from: Date | null;
	to: Date | null;
};

/**
 * Eksekusi query laporan terkonsolidasi untuk Web API, CSV export, dan Google Sheets.
 */
export async function buildReportData(options: BuildReportOptions): Promise<ReportResult> {
	const { prisma, campWhere, canViewEvacueeNames, from, to } = options;

	const camps = await prisma.camp.findMany({
		where: campWhere,
		select: {
			id: true,
			name: true,
			maxCapacity: true,
			currentOccupants: true,
			status: true,
		},
		orderBy: { name: "asc" },
	});
	const campIds = camps.map((camp) => camp.id);

	const periodFilter = from || to ? { gte: from ?? undefined, lte: to ?? undefined } : undefined;

	const [evacuees, logistics, facilities, distributions, movements] = await Promise.all([
		prisma.evacueeRecord.findMany({
			where: {
				campId: { in: campIds },
				...(periodFilter
					? {
						OR: [
							{ arrivedAt: periodFilter },
							{ departedAt: periodFilter },
						],
					}
					: {}),
			},
			select: {
				id: true,
				name: true,
				totalFamily: true,
				hasSpecialNeeds: true,
				arrivedAt: true,
				departedAt: true,
				camp: { select: { id: true, name: true } },
			},
			orderBy: { arrivedAt: "desc" },
		}),
		prisma.logisticsItem.findMany({
			where: { campId: { in: campIds } },
			select: {
				id: true,
				itemName: true,
				quantity: true,
				unit: true,
				quantityBase: true,
				baseUnit: true,
				conversionStatus: true,
				status: true,
				camp: { select: { id: true, name: true } },
			},
			orderBy: [{ camp: { name: "asc" } }, { itemName: "asc" }],
		}),
		// Seluruh fasilitas posko (snapshot) untuk hitungan kecukupan; daftar laporan difilter setelahnya.
		prisma.facilityReport.findMany({
			where: { campId: { in: campIds } },
			select: {
				id: true,
				category: true,
				facilityName: true,
				quantity: true,
				status: true,
				description: true,
				createdAt: true,
				updatedAt: true,
				camp: { select: { id: true, name: true } },
			},
			orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
		}),
		prisma.distribution.findMany({
			where: {
				OR: [
					{ sourceCampId: { in: campIds } },
					{ destinationCampId: { in: campIds } },
				],
				...(periodFilter ? { createdAt: periodFilter } : {}),
			},
			select: {
				id: true,
				itemName: true,
				quantity: true,
				unit: true,
				requestedQuantity: true,
				requestedUnit: true,
				baseQuantity: true,
				baseUnit: true,
				conversionStatus: true,
				status: true,
				createdAt: true,
				shippedAt: true,
				receivedAt: true,
				sourceCamp: { select: { id: true, name: true } },
				destinationCamp: { select: { id: true, name: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.inventoryMovement.findMany({
			where: {
				campId: { in: campIds },
				...(periodFilter ? { createdAt: periodFilter } : {}),
			},
			select: {
				id: true,
				campId: true,
				logisticsItemId: true,
				type: true,
				quantity: true,
				unit: true,
				baseQuantity: true,
				baseUnit: true,
				createdAt: true,
				logisticsItem: {
					select: {
						id: true,
						itemName: true,
						unit: true,
						baseUnit: true,
					},
				},
				camp: {
					select: {
						id: true,
						name: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		}),
	]);

	// Hitung per-posko status logistik & fasilitas saat ini
	const logisticsByCamp = new Map<string, typeof logistics>();
	for (const item of logistics) {
		const list = logisticsByCamp.get(item.camp.id);
		if (list) list.push(item);
		else logisticsByCamp.set(item.camp.id, [item]);
	}
	const facilitiesByCamp = new Map<string, typeof facilities>();
	for (const facility of facilities) {
		const list = facilitiesByCamp.get(facility.camp.id);
		if (list) list.push(facility);
		else facilitiesByCamp.set(facility.camp.id, [facility]);
	}

	const totalCapacity = camps.reduce((sum, camp) => sum + camp.maxCapacity, 0);
	const totalOccupants = camps.reduce((sum, camp) => sum + camp.currentOccupants, 0);

	const campRows = camps.map((camp) => {
		const campLogistics = logisticsByCamp.get(camp.id) ?? [];
		const campFacilities = facilitiesByCamp.get(camp.id) ?? [];
		const assessment = assessFacilities(camp.currentOccupants, campFacilities);
		return {
			...camp,
			occupancyPercentage: occupancyPercentage(camp.currentOccupants, camp.maxCapacity),
			problemLogistics: campLogistics.filter((item) => PROBLEM_LOGISTICS_STATUSES.includes(item.status)).length,
			damagedFacilities: campFacilities.filter((facility) => PROBLEM_FACILITY_STATUSES.includes(facility.status)).length,
			facilitySufficiency: assessment.overall,
			facilitySummary: sufficiencySummary(assessment),
		};
	});

	// Hitung pengungsi tiba & keluar dalam periode
	const isWithinPeriod = (date: Date | null) => {
		if (!date) return false;
		if (from && date < from) return false;
		if (to && date > to) return false;
		return true;
	};

	// Fasilitas rusak yang dilaporkan sebelum periode tetap tampil selama belum selesai ditangani.
	const reportedFacilities = periodFilter
		? facilities.filter(
			(facility) =>
				PROBLEM_FACILITY_STATUSES.includes(facility.status) || isWithinPeriod(facility.createdAt) || isWithinPeriod(facility.updatedAt),
		)
		: facilities;

	const arrivedRecords = evacuees.filter((record) => isWithinPeriod(record.arrivedAt));
	const departedRecords = evacuees.filter((record) => record.departedAt && isWithinPeriod(record.departedAt));

	// Agregasi mutasi stok per barang per posko
	const movementsMap = new Map<string, StockMovementSummaryRow>();
	for (const movement of movements) {
		const key = `${movement.campId}:${movement.logisticsItemId}`;
		let summaryRow = movementsMap.get(key);
		if (!summaryRow) {
			summaryRow = {
				campId: movement.campId,
				campName: movement.camp.name,
				logisticsItemId: movement.logisticsItemId,
				itemName: movement.logisticsItem.itemName,
				unit: movement.unit ?? movement.logisticsItem.unit,
				baseUnit: movement.baseUnit ?? movement.logisticsItem.baseUnit,
				receiptQty: 0,
				distributionInQty: 0,
				totalInQty: 0,
				distributionOutQty: 0,
				damagedQty: 0,
				lossQty: 0,
				disposedQty: 0,
				restoredQty: 0,
				movementCount: 0,
			};
			movementsMap.set(key, summaryRow);
		}

		summaryRow.movementCount += 1;
		const qty = movement.quantity;
		switch (movement.type) {
			case "RECEIPT":
				summaryRow.receiptQty += qty;
				summaryRow.totalInQty += qty;
				break;
			case "DISTRIBUTION_IN":
				summaryRow.distributionInQty += qty;
				summaryRow.totalInQty += qty;
				break;
			case "DISTRIBUTION_OUT":
				summaryRow.distributionOutQty += qty;
				break;
			case "DAMAGE":
				summaryRow.damagedQty += qty;
				break;
			case "LOSS":
				summaryRow.lossQty += qty;
				break;
			case "DISPOSE":
				summaryRow.disposedQty += qty;
				break;
			case "RESTORE":
				summaryRow.restoredQty += qty;
				break;
			case "RESERVATION":
			case "RESERVATION_RELEASE":
				// Reservasi internal tidak mengubah kepemilikan fisik sampai keluar
				break;
		}
	}

	const stockMovements = Array.from(movementsMap.values()).sort((a, b) => {
		const cmp = a.campName.localeCompare(b.campName);
		return cmp !== 0 ? cmp : a.itemName.localeCompare(b.itemName);
	});

	const sanitizedEvacuees = evacuees.map((record) => ({
		id: record.id,
		name: canViewEvacueeNames ? record.name : "Pengungsi (disamarkan)",
		totalFamily: record.totalFamily,
		hasSpecialNeeds: record.hasSpecialNeeds,
		arrivedAt: record.arrivedAt.toISOString(),
		departedAt: record.departedAt ? record.departedAt.toISOString() : null,
		arrivedAtFormatted: formatDateTimeWIB(record.arrivedAt),
		departedAtFormatted: formatDateTimeWIB(record.departedAt),
		camp: record.camp,
	}));

	return {
		period: {
			from: from?.toISOString() ?? null,
			to: to?.toISOString() ?? null,
			fromFormatted: from ? formatDateWIB(from) : "Awal",
			toFormatted: to ? formatDateWIB(to) : "Sekarang",
		},
		canViewEvacueeNames,
		summary: {
			totalCamps: camps.length,
			totalCapacity,
			totalOccupants,
			occupancyPercentage: occupancyPercentage(totalOccupants, totalCapacity),
			criticalLogistics: logistics.filter((item) => PROBLEM_LOGISTICS_STATUSES.includes(item.status)).length,
			damagedFacilities: facilities.filter((facility) => PROBLEM_FACILITY_STATUSES.includes(facility.status)).length,
			campsBelowStandard: campRows.filter((camp) => camp.status === "ACTIVE" && camp.facilitySufficiency === "SHORT").length,
			arrivedEvacueeRecords: arrivedRecords.length,
			arrivedEvacueeFamilies: arrivedRecords.reduce((sum, r) => sum + r.totalFamily, 0),
			departedEvacueeRecords: departedRecords.length,
			departedEvacueeFamilies: departedRecords.reduce((sum, r) => sum + r.totalFamily, 0),
			specialNeeds: evacuees.filter((r) => r.hasSpecialNeeds).length,
			distributionsCount: distributions.length,
			receivedDistributionsCount: distributions.filter((d) => d.status === "RECEIVED").length,
			shippedDistributionsCount: distributions.filter((d) => d.status === "SHIPPED").length,
			totalMovementsCount: movements.length,
		},
		camps: campRows,
		evacuees: sanitizedEvacuees,
		logistics: logistics.map((item) => ({
			id: item.id,
			itemName: item.itemName,
			quantity: item.quantity,
			unit: item.unit,
			quantityBase: item.quantityBase,
			baseUnit: item.baseUnit,
			conversionStatus: item.conversionStatus as "CONFIGURED" | "NEEDS_REVIEW",
			status: item.status,
			camp: item.camp,
		})),
		stockMovements,
		facilities: reportedFacilities.map((facility) => {
			const info = FACILITY_CATEGORY_INFO[facility.category];
			return {
				id: facility.id,
				category: facility.category,
				categoryLabel: info.label,
				facilityName: facility.facilityName,
				quantity: facility.quantity,
				quantityFormatted: formatFacilityQuantity(facility.quantity, info.unit),
				status: facility.status,
				description: facility.description,
				createdAt: facility.createdAt.toISOString(),
				createdAtFormatted: formatDateTimeWIB(facility.createdAt),
				updatedAt: facility.updatedAt.toISOString(),
				updatedAtFormatted: formatDateTimeWIB(facility.updatedAt),
				camp: facility.camp,
			};
		}),
		distributions: distributions.map((distribution) => ({
			id: distribution.id,
			itemName: distribution.itemName,
			quantity: distribution.requestedQuantity ?? distribution.quantity,
			unit: distribution.requestedUnit ?? distribution.unit,
			baseQuantity: distribution.baseQuantity,
			baseUnit: distribution.baseUnit,
			conversionStatus: distribution.conversionStatus as "CONFIGURED" | "NEEDS_REVIEW",
			status: distribution.status,
			createdAt: distribution.createdAt.toISOString(),
			createdAtFormatted: formatDateTimeWIB(distribution.createdAt),
			shippedAt: distribution.shippedAt ? distribution.shippedAt.toISOString() : null,
			receivedAt: distribution.receivedAt ? distribution.receivedAt.toISOString() : null,
			sourceCamp: distribution.sourceCamp,
			destinationCamp: distribution.destinationCamp,
		})),
	};
}

function escapeCsvCell(value: unknown): string {
	if (value === null || value === undefined) return "";
	const stringValue = String(value);
	if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n") || stringValue.includes("\r")) {
		return `"${stringValue.replace(/"/g, "\"\"")}"`;
	}
	return stringValue;
}

function toCsvRow(cells: unknown[]): string {
	return cells.map(escapeCsvCell).join(",");
}

/**
 * Generate string CSV lengkap ber-BOM UTF-8 dengan beberapa section terstruktur.
 */
export function buildReportCsv(report: ReportResult): string {
	const lines: string[] = [];

	// Header metadata
	lines.push(toCsvRow(["LAPORAN OPERASIONAL SIAGA BENCANA"]));
	lines.push(toCsvRow(["Periode", `${report.period.fromFormatted} s/d ${report.period.toFormatted}`]));
	lines.push(toCsvRow(["Waktu Ekspor", formatDateTimeWIB(new Date())]));
	lines.push("");

	// 1. Ringkasan
	lines.push(toCsvRow(["=== RINGKASAN OPERASIONAL ==="]));
	lines.push(toCsvRow(["Metrik", "Nilai", "Kategori"]));
	lines.push(toCsvRow(["Total Posko Aktif", report.summary.totalCamps, "Snapshot Saat Ini"]));
	lines.push(toCsvRow(["Total Kapasitas (Jiwa)", report.summary.totalCapacity, "Snapshot Saat Ini"]));
	lines.push(toCsvRow(["Total Penghuni Saat Ini (Jiwa)", report.summary.totalOccupants, "Snapshot Saat Ini"]));
	lines.push(toCsvRow(["Tingkat Okupansi (%)", `${report.summary.occupancyPercentage}%`, "Snapshot Saat Ini"]));
	lines.push(toCsvRow(["Logistik Bermasalah (Jenis)", report.summary.criticalLogistics, "Snapshot Saat Ini"]));
	lines.push(toCsvRow(["Fasilitas Bermasalah", report.summary.damagedFacilities, "Snapshot Saat Ini"]));
	lines.push(toCsvRow(["Posko di Bawah Standar Fasilitas", report.summary.campsBelowStandard, "Snapshot Saat Ini"]));
	lines.push(toCsvRow(["Pengungsi Tiba (KK)", report.summary.arrivedEvacueeRecords, "Dalam Periode"]));
	lines.push(toCsvRow(["Pengungsi Tiba (Jiwa)", report.summary.arrivedEvacueeFamilies, "Dalam Periode"]));
	lines.push(toCsvRow(["Pengungsi Keluar (KK)", report.summary.departedEvacueeRecords, "Dalam Periode"]));
	lines.push(toCsvRow(["Pengungsi Keluar (Jiwa)", report.summary.departedEvacueeFamilies, "Dalam Periode"]));
	lines.push(toCsvRow(["Pengungsi Kebutuhan Khusus", report.summary.specialNeeds, "Dalam Periode"]));
	lines.push(toCsvRow(["Total Distribusi Logistik", report.summary.distributionsCount, "Dalam Periode"]));
	lines.push(toCsvRow(["Distribusi Selesai Diterima", report.summary.receivedDistributionsCount, "Dalam Periode"]));
	lines.push(toCsvRow(["Total Transaksi Mutasi Stok", report.summary.totalMovementsCount, "Dalam Periode"]));
	lines.push("");

	// 2. Status Posko
	lines.push(toCsvRow(["=== STATUS POSKO (SNAPSHOT SAAT INI) ==="]));
	lines.push(toCsvRow(["Posko", "Status", "Kapasitas Maks", "Penghuni Saat Ini", "Okupansi (%)", "Logistik Bermasalah", "Fasilitas Bermasalah", "Kecukupan Fasilitas"]));
	for (const camp of report.camps) {
		lines.push(toCsvRow([
			camp.name,
			camp.status,
			camp.maxCapacity,
			camp.currentOccupants,
			`${camp.occupancyPercentage}%`,
			camp.problemLogistics,
			camp.damagedFacilities,
			camp.facilitySummary,
		]));
	}
	lines.push("");

	// 3. Mutasi Stok Logistik
	lines.push(toCsvRow(["=== RINGKASAN MUTASI STOK LOGISTIK (DALAM PERIODE) ==="]));
	lines.push(toCsvRow(["Posko", "Nama Barang", "Masuk (Penerimaan)", "Masuk (Distribusi)", "Total Masuk", "Keluar (Distribusi)", "Rusak", "Hilang", "Dibuang", "Dipulihkan", "Satuan", "Total Transaksi"]));
	if (report.stockMovements.length === 0) {
		lines.push(toCsvRow(["(Tidak ada pergerakan stok dalam periode ini)"]));
	} else {
		for (const row of report.stockMovements) {
			lines.push(toCsvRow([
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
			]));
		}
	}
	lines.push("");

	// 4. Stok Logistik Saat Ini
	lines.push(toCsvRow(["=== STOK LOGISTIK SAAT INI (SNAPSHOT) ==="]));
	lines.push(toCsvRow(["Posko", "Nama Barang", "Jumlah", "Satuan", "Saldo Dasar", "Satuan Dasar", "Status Konversi", "Status Operasional"]));
	for (const item of report.logistics) {
		lines.push(toCsvRow([
			item.camp.name,
			item.itemName,
			item.quantity,
			item.unit,
			item.quantityBase,
			item.baseUnit,
			item.conversionStatus,
			item.status,
		]));
	}
	lines.push("");

	// 5. Distribusi
	lines.push(toCsvRow(["=== DISTRIBUSI LOGISTIK (DALAM PERIODE) ==="]));
	lines.push(toCsvRow(["Tanggal Dibuat", "Nama Barang", "Posko Asal", "Posko Tujuan", "Jumlah", "Satuan", "Status", "Waktu Kirim", "Waktu Terima"]));
	if (report.distributions.length === 0) {
		lines.push(toCsvRow(["(Tidak ada distribusi dalam periode ini)"]));
	} else {
		for (const dist of report.distributions) {
			lines.push(toCsvRow([
				dist.createdAtFormatted,
				dist.itemName,
				dist.sourceCamp.name,
				dist.destinationCamp.name,
				dist.quantity,
				dist.unit,
				dist.status,
				dist.shippedAt ? formatDateTimeWIB(dist.shippedAt) : "-",
				dist.receivedAt ? formatDateTimeWIB(dist.receivedAt) : "-",
			]));
		}
	}
	lines.push("");

	// 6. Fasilitas
	lines.push(toCsvRow(["=== LAPORAN FASILITAS POSKO (BERMASALAH & AKTIVITAS PERIODE) ==="]));
	lines.push(toCsvRow(["Dilaporkan", "Diperbarui", "Posko", "Kategori", "Nama Fasilitas", "Jumlah", "Status", "Keterangan"]));
	if (report.facilities.length === 0) {
		lines.push(toCsvRow(["(Tidak ada fasilitas bermasalah atau aktivitas fasilitas dalam periode ini)"]));
	} else {
		for (const fac of report.facilities) {
			lines.push(toCsvRow([
				fac.createdAtFormatted,
				fac.updatedAtFormatted,
				fac.camp.name,
				fac.categoryLabel,
				fac.facilityName,
				fac.quantityFormatted,
				fac.status,
				fac.description,
			]));
		}
	}
	lines.push("");

	// 7. Pengungsi
	lines.push(toCsvRow(["=== AKTIVITAS PENGUNGSI (DALAM PERIODE) ==="]));
	lines.push(toCsvRow(["Nama KK", "Posko", "Jumlah Jiwa", "Kebutuhan Khusus", "Waktu Tiba", "Waktu Keluar"]));
	if (report.evacuees.length === 0) {
		lines.push(toCsvRow(["(Tidak ada aktivitas pengungsi dalam periode ini)"]));
	} else {
		for (const evac of report.evacuees) {
			lines.push(toCsvRow([
				evac.name,
				evac.camp.name,
				evac.totalFamily,
				evac.hasSpecialNeeds ? "Ya" : "Tidak",
				evac.arrivedAtFormatted,
				evac.departedAtFormatted,
			]));
		}
	}

	// Tambahkan UTF-8 BOM agar dibuka rapi di Excel tanpa corrupt huruf / angka
	return `﻿${lines.join("\r\n")}`;
}
