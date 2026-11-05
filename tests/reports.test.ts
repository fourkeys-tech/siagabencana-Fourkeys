import { describe, expect, it } from "vitest";
import {
	buildReportCsv,
	formatDateTimeWIB,
	formatDateWIB,
	getDefaultReportPeriodWIB,
	parseReportDate,
	type ReportResult,
} from "@/lib/reports";

describe("parseReportDate (WIB Timezone)", () => {
	it("mengurai tanggal valid ke jam 00:00:00 WIB (17:00:00 UTC hari sebelumnya)", () => {
		const date = parseReportDate("2026-11-04", false);
		expect(date).not.toBeNull();
		expect(date?.toISOString()).toBe("2026-11-03T17:00:00.000Z");
	});

	it("mengurai tanggal valid dengan endOfDay=true ke 23:59:59.999 WIB", () => {
		const date = parseReportDate("2026-11-04", true);
		expect(date).not.toBeNull();
		expect(date?.toISOString()).toBe("2026-11-04T16:59:59.999Z");
	});

	it("menolak tanggal yang meluap seperti 31 Februari", () => {
		expect(parseReportDate("2026-02-31", false)).toBeNull();
		expect(parseReportDate("2026-02-30", false)).toBeNull();
		expect(parseReportDate("2026-02-29", false)).toBeNull(); // 2026 bukan tahun kabisat
	});

	it("menerima 29 Februari pada tahun kabisat", () => {
		const leap = parseReportDate("2024-02-29", false);
		expect(leap).not.toBeNull();
		expect(leap?.toISOString()).toBe("2024-02-28T17:00:00.000Z");
	});

	it("menolak format yang tidak valid", () => {
		expect(parseReportDate("04-11-2026", false)).toBeNull();
		expect(parseReportDate("2026/11/04", false)).toBeNull();
		expect(parseReportDate("bukan-tanggal", false)).toBeNull();
		expect(parseReportDate("", false)).toBeNull();
		expect(parseReportDate(null, false)).toBeNull();
		expect(parseReportDate(undefined, false)).toBeNull();
	});
});

describe("formatDateWIB & formatDateTimeWIB", () => {
	it("memformat Date ke YYYY-MM-DD dalam zona waktu Asia/Jakarta", () => {
		// 2026-11-03 18:00 UTC == 2026-11-04 01:00 WIB
		const utc = new Date("2026-11-03T18:00:00.000Z");
		expect(formatDateWIB(utc)).toBe("2026-11-04");
	});

	it("memformat Date ke format lengkap dengan jam WIB", () => {
		const utc = new Date("2026-11-03T18:30:00.000Z");
		const formatted = formatDateTimeWIB(utc);
		expect(formatted).toContain("04/11/2026");
		expect(formatted).toContain("01.30 WIB");
	});

	it("menangani nilai kosong dengan '-'", () => {
		expect(formatDateWIB(null)).toBe("-");
		expect(formatDateTimeWIB(undefined)).toBe("-");
		expect(formatDateWIB("invalid")).toBe("-");
	});
});

describe("getDefaultReportPeriodWIB", () => {
	it("mengembalikan tanggal awal bulan dan hari ini dalam WIB", () => {
		const testDate = new Date("2026-11-15T02:00:00.000Z");
		const period = getDefaultReportPeriodWIB(testDate);
		expect(period.from).toBe("2026-11-01");
		expect(period.to).toBe("2026-11-15");
	});
});

describe("buildReportCsv", () => {
	const sampleReport: ReportResult = {
		period: {
			from: "2026-11-01T00:00:00.000Z",
			to: "2026-11-04T23:59:59.999Z",
			fromFormatted: "2026-11-01",
			toFormatted: "2026-11-04",
		},
		canViewEvacueeNames: true,
		summary: {
			totalCamps: 2,
			totalCapacity: 500,
			totalOccupants: 350,
			occupancyPercentage: 70,
			criticalLogistics: 1,
			damagedFacilities: 0,
			campsBelowStandard: 1,
			arrivedEvacueeRecords: 10,
			arrivedEvacueeFamilies: 35,
			departedEvacueeRecords: 2,
			departedEvacueeFamilies: 8,
			specialNeeds: 3,
			distributionsCount: 4,
			receivedDistributionsCount: 3,
			shippedDistributionsCount: 1,
			totalMovementsCount: 12,
		},
		camps: [
			{
				id: "c1",
				name: "Posko Merapi, Indah",
				status: "ACTIVE",
				maxCapacity: 300,
				currentOccupants: 200,
				occupancyPercentage: 66.67,
				problemLogistics: 1,
				damagedFacilities: 0,
				facilitySufficiency: "SHORT",
				facilitySummary: "Di bawah standar (Toilet / MCK kurang 2 bilik)",
			},
		],
		evacuees: [
			{
				id: "e1",
				name: "Keluarga \"Ahmad\"",
				totalFamily: 4,
				hasSpecialNeeds: true,
				arrivedAt: "2026-11-02T10:00:00.000Z",
				departedAt: null,
				arrivedAtFormatted: "02/11/2026 17.00 WIB",
				departedAtFormatted: "-",
				camp: { id: "c1", name: "Posko Merapi, Indah" },
			},
		],
		logistics: [
			{
				id: "l1",
				itemName: "Beras Pandan Wangi",
				quantity: 50,
				unit: "sak",
				quantityBase: 1250,
				baseUnit: "kg",
				conversionStatus: "CONFIGURED",
				status: "SUFFICIENT",
				camp: { id: "c1", name: "Posko Merapi, Indah" },
			},
		],
		stockMovements: [
			{
				campId: "c1",
				campName: "Posko Merapi, Indah",
				logisticsItemId: "l1",
				itemName: "Beras Pandan Wangi",
				unit: "sak",
				baseUnit: "kg",
				receiptQty: 60,
				distributionInQty: 0,
				totalInQty: 60,
				distributionOutQty: 10,
				damagedQty: 0,
				lossQty: 0,
				disposedQty: 0,
				restoredQty: 0,
				movementCount: 3,
			},
		],
		facilities: [
			{
				id: "f1",
				category: "HEALTH",
				categoryLabel: "Pos kesehatan",
				facilityName: "Tenda Medis",
				quantity: 1,
				quantityFormatted: "1 unit",
				status: "GOOD",
				description: "Kondisi baik dan beroperasi",
				createdAt: "2026-11-01T08:00:00.000Z",
				createdAtFormatted: "01/11/2026 15.00 WIB",
				updatedAt: "2026-11-02T08:00:00.000Z",
				updatedAtFormatted: "02/11/2026 15.00 WIB",
				camp: { id: "c1", name: "Posko Merapi, Indah" },
			},
		],
		distributions: [
			{
				id: "d1",
				itemName: "Beras Pandan Wangi",
				quantity: 10,
				unit: "sak",
				baseQuantity: 250,
				baseUnit: "kg",
				conversionStatus: "CONFIGURED",
				status: "RECEIVED",
				createdAt: "2026-11-02T08:00:00.000Z",
				createdAtFormatted: "02/11/2026 15.00 WIB",
				shippedAt: "2026-11-02T09:00:00.000Z",
				receivedAt: "2026-11-02T11:00:00.000Z",
				sourceCamp: { id: "c1", name: "Posko Merapi, Indah" },
				destinationCamp: { id: "c2", name: "Posko Lereng" },
			},
		],
	};

	it("membuat CSV dengan UTF-8 BOM dan escape tanda koma / kutip dengan benar", () => {
		const csv = buildReportCsv(sampleReport);
		expect(csv.startsWith("﻿")).toBe(true);

		// Cell berkoma harus dibungkus tanda kutip
		expect(csv).toContain("\"Posko Merapi, Indah\"");

		// Cell berkutip harus di-escape menjadi ganda
		expect(csv).toContain("\"Keluarga \"\"Ahmad\"\"\"");

		// Berisi section-section utama
		expect(csv).toContain("=== RINGKASAN OPERASIONAL ===");
		expect(csv).toContain("=== STATUS POSKO (SNAPSHOT SAAT INI) ===");
		expect(csv).toContain("=== RINGKASAN MUTASI STOK LOGISTIK (DALAM PERIODE) ===");
		expect(csv).toContain("=== STOK LOGISTIK SAAT INI (SNAPSHOT) ===");
		expect(csv).toContain("=== DISTRIBUSI LOGISTIK (DALAM PERIODE) ===");
		expect(csv).toContain("=== LAPORAN FASILITAS POSKO (BERMASALAH & AKTIVITAS PERIODE) ===");
		expect(csv).toContain("Posko di Bawah Standar Fasilitas,1");
		expect(csv).toContain("Di bawah standar (Toilet / MCK kurang 2 bilik)");
		expect(csv).toContain("Pos kesehatan");
		expect(csv).toContain("=== AKTIVITAS PENGUNGSI (DALAM PERIODE) ===");
	});
});
