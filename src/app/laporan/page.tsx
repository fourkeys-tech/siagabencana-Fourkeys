"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ReportData {
	period: { from: string | null; to: string | null };
	summary: {
		totalCamps: number;
		totalCapacity: number;
		totalOccupants: number;
		occupancyPercentage: number;
		totalEvacueeRecords: number;
		totalEvacueeFamilies: number;
		specialNeeds: number;
		logisticsItems: number;
		logisticsQuantity: number;
		criticalLogistics: number;
		damagedFacilities: number;
		distributions: number;
		receivedDistributions: number;
	};
	camps: Array<{
		id: string;
		name: string;
		status: string;
		maxCapacity: number;
		currentOccupants: number;
		occupancyPercentage: number;
		evacueeRecords: number;
		evacueeFamilies: number;
		logisticsItems: number;
		logisticsQuantity: number;
		problemLogistics: number;
		damagedFacilities: number;
	}>;
	evacuees: Array<{
		id: string;
		name: string;
		totalFamily: number;
		hasSpecialNeeds: boolean;
		arrivedAt: string;
		departedAt: string | null;
		camp: { name: string };
	}>;
	logistics: Array<{
		id: string;
		itemName: string;
		quantity: number;
		unit: string;
		status: string;
		camp: { name: string };
	}>;
	facilities: Array<{
		id: string;
		facilityName: string;
		status: string;
		description: string;
		createdAt: string;
		camp: { name: string };
	}>;
	distributions: Array<{
		id: string;
		itemName: string;
		quantity: number;
		unit: string;
		status: string;
		createdAt: string;
		sourceCamp: { name: string };
		destinationCamp: { name: string };
	}>;
}

function dateLabel(value: string | null) {
	return value ? new Date(value).toLocaleDateString("id-ID") : "-";
}

export default function ReportsPage() {
	const now = new Date();
	const [from, setFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
	const [to, setTo] = useState(now.toISOString().slice(0, 10));
	const [data, setData] = useState<ReportData | null>(null);
	const [loading, setLoading] = useState(true);
	const [exportingSheets, setExportingSheets] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const loadReport = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const response = await fetch(`/api/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
			const result = await response.json();
			if (!response.ok || !result.success) throw new Error(result.message ?? "Gagal mengambil data laporan.");
			setData(result.data);
		} catch (reportError) {
			setError(reportError instanceof Error ? reportError.message : "Gagal mengambil data laporan.");
		} finally {
			setLoading(false);
		}
	}, [from, to]);

	useEffect(() => {
		const timer = window.setTimeout(() => loadReport(), 0);
		return () => window.clearTimeout(timer);
	}, [loadReport]);

	const exportToGoogleSheets = async () => {
		setExportingSheets(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/reports/sheets", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ from, to }),
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.message ?? "Gagal mengirim laporan ke Google Sheets.");
			}
			setMessage(result.message);
		} catch (exportError) {
			setError(exportError instanceof Error ? exportError.message : "Gagal mengirim laporan ke Google Sheets.");
		} finally {
			setExportingSheets(false);
		}
	};


	return (
		<div className="space-y-6 print:space-y-3">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">Reporting workspace</div>
					<h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Laporan operasional</h1>
					<p className="mt-2 text-sm text-slate-500">Ringkasan terukur berdasarkan periode dan posko yang dapat Anda akses.</p>
				</div>
				<div className="flex flex-wrap gap-2 print:hidden">
					<Button variant="secondary" onClick={() => window.print()} disabled={!data}>Export PDF</Button>
					<Button onClick={exportToGoogleSheets} disabled={!data || exportingSheets}>{exportingSheets ? "Mengirim..." : "Kirim ke Google Sheets"}</Button>
				</div>
			</div>

			<div className="rounded-lg border bg-white p-4 shadow-sm print:hidden">
				<div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
					<label className="block text-sm font-medium text-gray-700">Mulai<input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
					<label className="block text-sm font-medium text-gray-700">Sampai<input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
					<Button onClick={loadReport} disabled={loading}>{loading ? "Memuat..." : "Generate"}</Button>
				</div>
			</div>

			{error && <Alert type="error">{error}</Alert>}
			{message && <Alert type="success">{message}</Alert>}
			{loading && <div className="py-12 text-center text-gray-500">Memuat laporan...</div>}

			{data && !loading && <>
				<div className="hidden print:block"><p className="text-sm text-gray-600">Periode: {from} sampai {to}</p></div>
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4 print:grid-cols-4">
					<Card><CardLabel>Total Posko</CardLabel><CardValue>{data.summary.totalCamps}</CardValue></Card>
					<Card><CardLabel>Total Pengungsi</CardLabel><CardValue>{data.summary.totalEvacueeFamilies}</CardValue></Card>
					<Card><CardLabel>Okupansi</CardLabel><CardValue>{data.summary.occupancyPercentage}%</CardValue></Card>
					<Card><CardLabel>Distribusi</CardLabel><CardValue>{data.summary.distributions}</CardValue></Card>
				</div>

				<div className="grid gap-4 md:grid-cols-4">
					<Card><CardLabel>Kapasitas Total</CardLabel><CardValue>{data.summary.totalCapacity}</CardValue></Card>
					<Card><CardLabel>Logistik Bermasalah</CardLabel><CardValue className="text-red-600">{data.summary.criticalLogistics}</CardValue></Card>
					<Card><CardLabel>Fasilitas Rusak</CardLabel><CardValue className="text-yellow-600">{data.summary.damagedFacilities}</CardValue></Card>
					<Card><CardLabel>Distribusi Diterima</CardLabel><CardValue className="text-green-600">{data.summary.receivedDistributions}</CardValue></Card>
				</div>

				<section className="rounded-lg border bg-white shadow-sm">
					<div className="border-b px-5 py-4"><h2 className="font-semibold">Status Posko</h2></div>
					<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{["Posko", "Status", "Kapasitas", "Penghuni", "Okupansi", "Logistik Bermasalah", "Fasilitas Bermasalah"].map((header) => <th key={header} className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{data.camps.map((camp) => <tr key={camp.id}><td className="px-5 py-3 text-sm font-medium">{camp.name}</td><td className="px-5 py-3"><Badge label={camp.status} /></td><td className="px-5 py-3 text-sm">{camp.maxCapacity}</td><td className="px-5 py-3 text-sm">{camp.currentOccupants}</td><td className="px-5 py-3 text-sm">{camp.occupancyPercentage}%</td><td className="px-5 py-3 text-sm">{camp.problemLogistics}</td><td className="px-5 py-3 text-sm">{camp.damagedFacilities}</td></tr>)}</tbody></table></div>
				</section>

				<section className="rounded-lg border bg-white shadow-sm print:break-before-page">
					<div className="border-b px-5 py-4"><h2 className="font-semibold">Aktivitas Pengungsi</h2></div>
					<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{["Nama", "Posko", "Jumlah Keluarga", "Kebutuhan Khusus", "Tiba", "Keluar"].map((header) => <th key={header} className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{data.evacuees.map((record) => <tr key={record.id}><td className="px-5 py-3 text-sm font-medium">{record.name}</td><td className="px-5 py-3 text-sm">{record.camp.name}</td><td className="px-5 py-3 text-sm">{record.totalFamily}</td><td className="px-5 py-3 text-sm">{record.hasSpecialNeeds ? "Ya" : "Tidak"}</td><td className="px-5 py-3 text-sm">{dateLabel(record.arrivedAt)}</td><td className="px-5 py-3 text-sm">{dateLabel(record.departedAt)}</td></tr>)}</tbody></table></div>
				</section>
			</>}
		</div>
	);
}
