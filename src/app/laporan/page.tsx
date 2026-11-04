"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableCell, TableRow } from "@/components/ui/table";
import { SkeletonCard } from "@/components/ui/skeleton";
import type { ReportResult, StockMovementSummaryRow } from "@/lib/reports";

type ReportApiResponse = ReportResult & {
	/** null bila role tidak dapat ekspor ke Google Sheets. */
	sheets: { serviceAccountConfigured: boolean; spreadsheetConfigured: boolean } | null;
};

type SheetsExportResult = {
	spreadsheetId: string;
	sheetTitle: string;
	sheetId: number;
	spreadsheetUrl: string;
	rows: number;
};

function getInitialDates(): { from: string; to: string } {
	// Waktu sekarang dalam zona waktu Asia/Jakarta (WIB)
	const now = new Date();
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const todayWIB = formatter.format(now);
	const [year, month] = todayWIB.split("-");
	return {
		from: `${year}-${month}-01`,
		to: todayWIB,
	};
}

export default function ReportsPage() {
	const initialDates = getInitialDates();
	const [from, setFrom] = useState(initialDates.from);
	const [to, setTo] = useState(initialDates.to);

	const [data, setData] = useState<ReportApiResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [exportingSheets, setExportingSheets] = useState(false);
	const [sheetsResult, setSheetsResult] = useState<SheetsExportResult | null>(null);
	const [sheetsError, setSheetsError] = useState("");

	const abortControllerRef = useRef<AbortController | null>(null);

	const fetchReport = async (fromDate: string, toDate: string) => {
		// Batalkan request sebelumnya yang masih berjalan
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		const controller = new AbortController();
		abortControllerRef.current = controller;

		setLoading(true);
		setError("");
		setSheetsResult(null);
		setSheetsError("");

		try {
			const query = new URLSearchParams({ from: fromDate, to: toDate }).toString();
			const response = await fetch(`/api/reports?${query}`, {
				cache: "no-store",
				signal: controller.signal,
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.message ?? "Gagal mengambil data laporan.");
			}
			setData(result.data as ReportApiResponse);
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				return;
			}
			setError(err instanceof Error ? err.message : "Gagal mengambil data laporan.");
		} finally {
			setLoading(false);
		}
	};

	// Muat data awal sekali saat halaman terbuka
	useEffect(() => {
		let active = true;
		const controller = new AbortController();
		const initial = getInitialDates();

		fetch(`/api/reports?from=${encodeURIComponent(initial.from)}&to=${encodeURIComponent(initial.to)}`, {
			cache: "no-store",
			signal: controller.signal,
		})
			.then((res) => res.json())
			.then((result) => {
				if (!active) return;
				if (result.success) {
					setData(result.data as ReportApiResponse);
				} else {
					setError(result.message ?? "Gagal mengambil data laporan.");
				}
				setLoading(false);
			})
			.catch((err) => {
				if (!active) return;
				if (err instanceof DOMException && err.name === "AbortError") return;
				setError(err instanceof Error ? err.message : "Gagal mengambil data laporan.");
				setLoading(false);
			});

		return () => {
			active = false;
			controller.abort();
		};
	}, []);

	const handleGenerate = () => {
		void fetchReport(from, to);
	};

	const exportToGoogleSheets = async () => {
		if (exportingSheets) return;
		setExportingSheets(true);
		setSheetsError("");
		setSheetsResult(null);

		try {
			const response = await fetch("/api/reports/sheets", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ from, to }),
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.message ?? "Gagal mengekspor ke Google Sheets.");
			}
			setSheetsResult(result.data as SheetsExportResult);
		} catch (err) {
			setSheetsError(err instanceof Error ? err.message : "Gagal mengekspor laporan.");
		} finally {
			setExportingSheets(false);
		}
	};

	const csvDownloadUrl = `/api/reports?format=csv&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

	return (
		<div className="space-y-6 print:space-y-4">
			{/* Header Halaman (Layar) */}
			<div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
				<div>
					<div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">Reporting workspace</div>
					<h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Laporan operasional</h1>
					<p className="mt-2 text-sm text-slate-500">
						Ringkasan snapshot posko saat ini dan aktivitas dalam periode terpilih (Waktu Indonesia Barat).
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="secondary" onClick={() => window.print()} disabled={!data || loading}>
						<Printer size={16} aria-hidden="true" />
						Export PDF
					</Button>
					<a
						href={csvDownloadUrl}
						download
						className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${!data || loading ? "pointer-events-none opacity-50" : ""}`}
					>
						<Download size={16} aria-hidden="true" />
						Download CSV
					</a>
					{data?.sheets?.serviceAccountConfigured && data.sheets.spreadsheetConfigured && (
						<Button onClick={exportToGoogleSheets} disabled={loading || exportingSheets}>
							<FileSpreadsheet size={16} aria-hidden="true" />
							{exportingSheets ? "Mengekspor..." : "Kirim ke Google Sheets"}
						</Button>
					)}
					{data?.sheets?.serviceAccountConfigured && !data.sheets.spreadsheetConfigured && (
						<Link
							href="/pengaturan#google-sheets"
							className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
						>
							<FileSpreadsheet size={16} aria-hidden="true" />
							Hubungkan Google Sheets
						</Link>
					)}
				</div>
			</div>

			{/* Header Khusus Print / PDF */}
			<div className="hidden print:block border-b border-slate-300 pb-3">
				<h1 className="text-xl font-bold text-slate-900">LAPORAN OPERASIONAL SIAGA BENCANA</h1>
				<div className="mt-1 flex justify-between text-xs text-slate-600">
					<span>Periode: <strong>{data?.period.fromFormatted ?? from}</strong> s/d <strong>{data?.period.toFormatted ?? to}</strong></span>
					<span>Dicetak: {new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</span>
				</div>
			</div>

			{/* Filter Periode (Layar saja) */}
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
				<div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
					<label className="block text-sm font-medium text-slate-700">
						Tanggal Mulai (WIB)
						<input
							className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							type="date"
							value={from}
							onChange={(e) => setFrom(e.target.value)}
						/>
					</label>
					<label className="block text-sm font-medium text-slate-700">
						Tanggal Akhir (WIB)
						<input
							className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							type="date"
							value={to}
							onChange={(e) => setTo(e.target.value)}
						/>
					</label>
					<Button onClick={handleGenerate} disabled={loading}>
						<RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
						{loading ? "Memuat..." : "Generate"}
					</Button>
				</div>
			</div>

			{error && <Alert type="error">{error}</Alert>}
			{sheetsError && <Alert type="error">{sheetsError}</Alert>}
			{sheetsResult && (
				<Alert type="success">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span>
							Laporan berhasil dibuat di tab <strong>{sheetsResult.sheetTitle}</strong> ({sheetsResult.rows} baris).
						</span>
						<a
							href={sheetsResult.spreadsheetUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 font-bold text-emerald-900 underline hover:text-emerald-950"
						>
							Buka di Google Sheets
							<ExternalLink size={14} aria-hidden="true" />
						</a>
					</div>
				</Alert>
			)}

			{loading && !data && (
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
						{Array.from({ length: 6 }).map((_, i) => (
							<SkeletonCard key={i} />
						))}
					</div>
					<div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
				</div>
			)}

			{data && (
				<>
					{/* Bagian 1: Snapshot Kondisi Saat Ini */}
					<section className="space-y-3">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
									Kondisi Posko Saat Ini (Snapshot)
								</h2>
								<p className="text-xs text-slate-500">Angka real-time posko dan ketersediaan sarana logistik.</p>
							</div>
							<span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 print:hidden">
								Saat Ini
							</span>
						</div>

						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 print:gap-2">
							<Card className="print:p-3">
								<CardLabel>Posko Aktif</CardLabel>
								<CardValue>{data.summary.totalCamps}</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Kapasitas Total</CardLabel>
								<CardValue>{data.summary.totalCapacity.toLocaleString("id-ID")}</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Penghuni Saat Ini</CardLabel>
								<CardValue>{data.summary.totalOccupants.toLocaleString("id-ID")}</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Okupansi Rata-rata</CardLabel>
								<CardValue>{data.summary.occupancyPercentage}%</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Logistik Bermasalah</CardLabel>
								<CardValue className={data.summary.criticalLogistics > 0 ? "text-rose-600" : ""}>
									{data.summary.criticalLogistics}
								</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Fasilitas Rusak</CardLabel>
								<CardValue className={data.summary.damagedFacilities > 0 ? "text-amber-600" : ""}>
									{data.summary.damagedFacilities}
								</CardValue>
							</Card>
						</div>
					</section>

					{/* Bagian 2: Aktivitas Dalam Periode */}
					<section className="space-y-3">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-sm font-bold uppercase tracking-wider text-blue-700">
									Aktivitas Dalam Periode ({data.period.fromFormatted} s/d {data.period.toFormatted})
								</h2>
								<p className="text-xs text-slate-500">Arus masuk/keluar pengungsi, pergerakan barang, dan distribusi logistik.</p>
							</div>
							<span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 print:hidden">
								Dalam Periode
							</span>
						</div>

						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 print:gap-2">
							<Card className="print:p-3">
								<CardLabel>Pengungsi Tiba</CardLabel>
								<CardValue className="text-blue-700">
									{data.summary.arrivedEvacueeFamilies}{" "}
									<span className="text-xs font-normal text-slate-500">({data.summary.arrivedEvacueeRecords} KK)</span>
								</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Pengungsi Keluar</CardLabel>
								<CardValue className="text-slate-700">
									{data.summary.departedEvacueeFamilies}{" "}
									<span className="text-xs font-normal text-slate-500">({data.summary.departedEvacueeRecords} KK)</span>
								</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Kebutuhan Khusus</CardLabel>
								<CardValue className={data.summary.specialNeeds > 0 ? "text-amber-600" : ""}>
									{data.summary.specialNeeds}
								</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Distribusi Terkirim</CardLabel>
								<CardValue>{data.summary.distributionsCount}</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Distribusi Selesai</CardLabel>
								<CardValue className="text-emerald-600">{data.summary.receivedDistributionsCount}</CardValue>
							</Card>
							<Card className="print:p-3">
								<CardLabel>Transaksi Mutasi</CardLabel>
								<CardValue>{data.summary.totalMovementsCount}</CardValue>
							</Card>
						</div>
					</section>

					{/* Tabel 1: Status Posko (Snapshot) */}
					<section className="space-y-3 print:break-inside-avoid">
						<div className="flex items-center justify-between">
							<h3 className="text-base font-bold text-slate-900">1. Status & Kapasitas Posko</h3>
							<span className="text-xs text-slate-500">{data.camps.length} posko tercatat</span>
						</div>
						<Table
							label="Tabel status posko"
							headers={["Posko", "Status", "Kapasitas", "Penghuni", "Okupansi", "Logistik Bermasalah", "Fasilitas Rusak"]}
						>
							{data.camps.map((camp) => (
								<TableRow key={camp.id}>
									<TableCell className="font-semibold text-slate-950">{camp.name}</TableCell>
									<TableCell><Badge label={camp.status} /></TableCell>
									<TableCell>{camp.maxCapacity.toLocaleString("id-ID")} jiwa</TableCell>
									<TableCell>{camp.currentOccupants.toLocaleString("id-ID")} jiwa</TableCell>
									<TableCell className="font-semibold">{camp.occupancyPercentage}%</TableCell>
									<TableCell className={camp.problemLogistics > 0 ? "font-bold text-rose-600" : ""}>
										{camp.problemLogistics}
									</TableCell>
									<TableCell className={camp.damagedFacilities > 0 ? "font-bold text-amber-600" : ""}>
										{camp.damagedFacilities}
									</TableCell>
								</TableRow>
							))}
						</Table>
					</section>

					{/* Tabel 2: Mutasi Stok Logistik (Periode) */}
					<section className="space-y-3 print:break-inside-avoid">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-base font-bold text-slate-900">2. Ringkasan Mutasi Stok Logistik</h3>
								<p className="text-xs text-slate-500">Akumulasi pergerakan barang dalam periode ({data.period.fromFormatted} s/d {data.period.toFormatted}).</p>
							</div>
							<span className="text-xs text-slate-500">{data.stockMovements.length} barang termutasi</span>
						</div>
						{data.stockMovements.length === 0 ? (
							<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
								Tidak ada catatan mutasi stok logistik dalam periode ini.
							</div>
						) : (
							<Table
								label="Tabel ringkasan mutasi stok"
								minWidth="min-w-[56rem]"
								headers={[
									"Posko",
									"Nama Barang",
									"Masuk (Terima)",
									"Masuk (Distribusi)",
									"Total Masuk",
									"Keluar (Distribusi)",
									"Rusak",
									"Hilang",
									"Dibuang",
									"Dipulihkan",
									"Satuan",
								]}
							>
								{data.stockMovements.map((row: StockMovementSummaryRow) => (
									<TableRow key={`${row.campId}-${row.logisticsItemId}`}>
										<TableCell className="font-medium text-slate-900">{row.campName}</TableCell>
										<TableCell className="font-semibold text-slate-950">{row.itemName}</TableCell>
										<TableCell className="text-emerald-700">+{row.receiptQty}</TableCell>
										<TableCell className="text-emerald-700">+{row.distributionInQty}</TableCell>
										<TableCell className="font-bold text-emerald-800">+{row.totalInQty}</TableCell>
										<TableCell className="text-rose-700">-{row.distributionOutQty}</TableCell>
										<TableCell className={row.damagedQty > 0 ? "text-amber-700" : ""}>{row.damagedQty}</TableCell>
										<TableCell className={row.lossQty > 0 ? "text-rose-700" : ""}>{row.lossQty}</TableCell>
										<TableCell className={row.disposedQty > 0 ? "text-slate-500" : ""}>{row.disposedQty}</TableCell>
										<TableCell className={row.restoredQty > 0 ? "text-blue-700" : ""}>{row.restoredQty}</TableCell>
										<TableCell className="font-medium text-slate-600">{row.unit}</TableCell>
									</TableRow>
								))}
							</Table>
						)}
					</section>

					{/* Tabel 3: Stok Logistik Saat Ini (Snapshot) */}
					<section className="space-y-3 print:break-inside-avoid">
						<div className="flex items-center justify-between">
							<h3 className="text-base font-bold text-slate-900">3. Stok Logistik Saat Ini (Snapshot)</h3>
							<span className="text-xs text-slate-500">{data.logistics.length} jenis barang</span>
						</div>
						<Table
							label="Tabel stok logistik saat ini"
							headers={["Nama Barang", "Posko", "Stok Tersedia", "Saldo Dasar", "Konversi", "Status"]}
						>
							{data.logistics.map((item) => (
								<TableRow key={item.id}>
									<TableCell className="font-semibold text-slate-950">{item.itemName}</TableCell>
									<TableCell>{item.camp.name}</TableCell>
									<TableCell className="font-medium">
										{item.quantity.toLocaleString("id-ID")} {item.unit}
									</TableCell>
									<TableCell className="text-slate-600">
										{item.quantityBase.toLocaleString("id-ID")} {item.baseUnit}
									</TableCell>
									<TableCell>
										{item.conversionStatus === "NEEDS_REVIEW" ? (
											<span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
												Perlu Verifikasi
											</span>
										) : (
											<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
												Terverifikasi
											</span>
										)}
									</TableCell>
									<TableCell><Badge label={item.status} /></TableCell>
								</TableRow>
							))}
						</Table>
					</section>

					{/* Tabel 4: Pengiriman Distribusi (Periode) */}
					<section className="space-y-3 print:break-inside-avoid">
						<div className="flex items-center justify-between">
							<h3 className="text-base font-bold text-slate-900">4. Distribusi Logistik Antar Posko</h3>
							<span className="text-xs text-slate-500">{data.distributions.length} transaksi</span>
						</div>
						{data.distributions.length === 0 ? (
							<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
								Tidak ada distribusi logistik dalam periode ini.
							</div>
						) : (
							<Table
								label="Tabel distribusi logistik"
								minWidth="min-w-[50rem]"
								headers={["Tanggal", "Nama Barang", "Asal", "Tujuan", "Jumlah", "Status"]}
							>
								{data.distributions.map((distribution) => (
									<TableRow key={distribution.id}>
										<TableCell className="text-xs text-slate-600">{distribution.createdAtFormatted}</TableCell>
										<TableCell className="font-semibold text-slate-950">{distribution.itemName}</TableCell>
										<TableCell>{distribution.sourceCamp.name}</TableCell>
										<TableCell>{distribution.destinationCamp.name}</TableCell>
										<TableCell className="font-medium">
											{distribution.quantity.toLocaleString("id-ID")} {distribution.unit}
										</TableCell>
										<TableCell><Badge label={distribution.status} /></TableCell>
									</TableRow>
								))}
							</Table>
						)}
					</section>

					{/* Tabel 5: Fasilitas Posko (Periode) */}
					<section className="space-y-3 print:break-inside-avoid">
						<div className="flex items-center justify-between">
							<h3 className="text-base font-bold text-slate-900">5. Laporan Kondisi Fasilitas</h3>
							<span className="text-xs text-slate-500">{data.facilities.length} laporan</span>
						</div>
						{data.facilities.length === 0 ? (
							<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
								Tidak ada laporan fasilitas dalam periode ini.
							</div>
						) : (
							<Table
								label="Tabel fasilitas posko"
								headers={["Waktu Lapor", "Posko", "Nama Fasilitas", "Status", "Keterangan"]}
							>
								{data.facilities.map((facility) => (
									<TableRow key={facility.id}>
										<TableCell className="text-xs text-slate-600">{facility.createdAtFormatted}</TableCell>
										<TableCell>{facility.camp.name}</TableCell>
										<TableCell className="font-semibold text-slate-950">{facility.facilityName}</TableCell>
										<TableCell><Badge label={facility.status} /></TableCell>
										<TableCell className="max-w-md truncate text-slate-600">{facility.description}</TableCell>
									</TableRow>
								))}
							</Table>
						)}
					</section>

					{/* Tabel 6: Aktivitas Pengungsi (Periode) */}
					<section className="space-y-3 print:break-inside-avoid">
						<div className="flex items-center justify-between">
							<h3 className="text-base font-bold text-slate-900">6. Aktivitas Pengungsi</h3>
							<span className="text-xs text-slate-500">{data.evacuees.length} catatan</span>
						</div>
						{!data.canViewEvacueeNames ? (
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-xs text-slate-600">
								Data identitas pengungsi dilindungi dan hanya dapat dilihat oleh Super Admin, Manager, atau Divisi Pendataan Posko. Total tercatat dalam periode: {data.summary.arrivedEvacueeFamilies} jiwa tiba, {data.summary.departedEvacueeFamilies} jiwa keluar, {data.summary.specialNeeds} memiliki kebutuhan khusus.
							</div>
						) : data.evacuees.length === 0 ? (
							<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
								Tidak ada aktivitas kedatangan atau kepulangan pengungsi dalam periode ini.
							</div>
						) : (
							<Table
								label="Tabel aktivitas pengungsi"
								headers={["Nama KK", "Posko", "Jumlah Jiwa", "Kebutuhan Khusus", "Tiba (WIB)", "Keluar (WIB)"]}
							>
								{data.evacuees.map((record) => (
									<TableRow key={record.id}>
										<TableCell className="font-semibold text-slate-950">{record.name}</TableCell>
										<TableCell>{record.camp.name}</TableCell>
										<TableCell className="font-medium">{record.totalFamily} jiwa</TableCell>
										<TableCell>
											{record.hasSpecialNeeds ? (
												<span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
													Ya
												</span>
											) : (
												<span className="text-slate-400">Tidak</span>
											)}
										</TableCell>
										<TableCell className="text-xs text-slate-600">{record.arrivedAtFormatted}</TableCell>
										<TableCell className="text-xs text-slate-600">{record.departedAtFormatted}</TableCell>
									</TableRow>
								))}
							</Table>
						)}
					</section>
				</>
			)}
		</div>
	);
}
