import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authError, isAuthError, requireAuth } from "@/lib/auth/guard";
import { writeReportToGoogleSheet, type ReportSheetRow } from "@/lib/google-sheets";

function parseDate(value: string | null, endOfDay = false) {
	if (!value) return null;
	const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
	return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
	try {
		const user = await requireAuth();
		const body = await request.json();
		const from = parseDate(body.from ?? null);
		const to = parseDate(body.to ?? null, true);

		if (!from || !to || from > to) {
			return NextResponse.json(
				{ success: false, message: "Periode laporan tidak valid." },
				{ status: 400 },
			);
		}

		const campWhere = user.role === "SUPER_ADMIN" ? {} : { id: user.campId ?? "" };
		const camps = await prisma.camp.findMany({
			where: campWhere,
			select: { id: true, name: true, maxCapacity: true, currentOccupants: true, status: true },
			orderBy: { name: "asc" },
		});
		const campIds = camps.map((camp) => camp.id);
		const period = { gte: from, lte: to };

		const [evacuees, logistics, facilities, distributions] = await Promise.all([
			prisma.evacueeRecord.findMany({
				where: { campId: { in: campIds }, arrivedAt: period },
				select: { name: true, totalFamily: true, hasSpecialNeeds: true, arrivedAt: true, departedAt: true, camp: { select: { name: true } } },
				orderBy: { arrivedAt: "desc" },
			}),
			prisma.logisticsItem.findMany({
				where: { campId: { in: campIds } },
				select: { itemName: true, quantity: true, unit: true, status: true, camp: { select: { name: true } } },
				orderBy: { updatedAt: "desc" },
			}),
			prisma.facilityReport.findMany({
				where: { campId: { in: campIds }, createdAt: period },
				select: { facilityName: true, status: true, description: true, createdAt: true, camp: { select: { name: true } } },
				orderBy: { createdAt: "desc" },
			}),
			prisma.distribution.findMany({
				where: { OR: [{ sourceCampId: { in: campIds } }, { destinationCampId: { in: campIds } }], createdAt: period },
				select: { itemName: true, quantity: true, unit: true, status: true, createdAt: true, sourceCamp: { select: { name: true } }, destinationCamp: { select: { name: true } } },
				orderBy: { createdAt: "desc" },
			}),
		]);

		const rows: ReportSheetRow[] = [
			["Periode", `${body.from} - ${body.to}`],
			[],
			["STATUS POSKO"],
			["Posko", "Status", "Kapasitas", "Penghuni", "Okupansi"],
			...camps.map((camp) => [camp.name, camp.status, camp.maxCapacity, camp.currentOccupants, camp.maxCapacity > 0 ? `${((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(2)}%` : "0%"]),
			[],
			["PENGUNGSI"],
			["Nama", "Posko", "Jumlah Keluarga", "Kebutuhan Khusus", "Tiba", "Keluar"],
			...evacuees.map((record) => [record.name, record.camp.name, record.totalFamily, record.hasSpecialNeeds ? "Ya" : "Tidak", record.arrivedAt.toISOString(), record.departedAt?.toISOString() ?? "-"]),
			[],
			["LOGISTIK"],
			["Barang", "Posko", "Jumlah", "Unit", "Status"],
			...logistics.map((item) => [item.itemName, item.camp.name, item.quantity, item.unit, item.status]),
			[],
			["FASILITAS"],
			["Fasilitas", "Posko", "Status", "Deskripsi", "Tanggal"],
			...facilities.map((facility) => [facility.facilityName, facility.camp.name, facility.status, facility.description, facility.createdAt.toISOString()]),
			[],
			["DISTRIBUSI"],
			["Barang", "Asal", "Tujuan", "Jumlah", "Unit", "Status", "Tanggal"],
			...distributions.map((distribution) => [distribution.itemName, distribution.sourceCamp.name, distribution.destinationCamp.name, distribution.quantity, distribution.unit, distribution.status, distribution.createdAt.toISOString()]),
		];

		const sectionRows: number[] = [];
		const headerRows: number[] = [];
		for (let index = 0; index < rows.length; index += 1) {
			const firstCell = rows[index]?.[0];
			const nextCell = rows[index + 1]?.[0];
			if (typeof firstCell === "string" && firstCell === firstCell.toUpperCase() && !nextCell) {
				sectionRows.push(index);
			}
			if (typeof firstCell === "string" && ["Posko", "Nama", "Barang", "Fasilitas"].includes(firstCell)) {
				headerRows.push(index);
			}
		}

		const result = await writeReportToGoogleSheet(
			rows,
			`LAPORAN SIAGA BENCANA | ${body.from} - ${body.to}`,
			{ sectionRows, headerRows, columnCount: 7 },
		);
		return NextResponse.json({ success: true, message: "Laporan berhasil dikirim ke Google Sheets.", data: result });
	} catch (error) {
		if (isAuthError(error)) return authError(error);

		console.error("EXPORT_REPORT_SHEETS_ERROR", error);
		return NextResponse.json(
			{ success: false, message: "Gagal mengirim laporan ke Google Sheets." },
			{ status: 500 },
		);
	}
}
