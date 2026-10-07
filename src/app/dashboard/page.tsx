"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Boxes, Building2, PackageCheck, Send, Users, Warehouse, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { occupancyBarClass } from "@/lib/occupancy";

interface DistributionRecord {
	id: string;
	itemName: string;
	quantity: number;
	unit: string;
	baseQuantity: number | null;
	baseUnit: string | null;
	conversionStatus: "CONFIGURED" | "NEEDS_REVIEW" | null;
	status: string;
	updatedAt: string;
	sourceCamp: { id: string; name: string };
	destinationCamp: { id: string; name: string };
}
interface Summary { totalCamps: number; totalCapacity: number; totalOccupants: number; availableCapacity: number; occupancyPercentage: number; staffCount: number; logisticsCount: number; criticalLogistics: number; damagedFacilities: number; specialNeeds: number; activeEvacuees: number; preparedDistributions: DistributionRecord[]; shippedDistributions: DistributionRecord[]; }
interface Camp { id: string; name: string; maxCapacity: number; currentOccupants: number; status: string; }

const stats = (summary: Summary) => [
	{ label: "Posko terdaftar", value: summary.totalCamps, icon: Building2, tone: "blue" },
	{ label: "Pengungsi aktif", value: summary.activeEvacuees, icon: Users, tone: "violet" },
	{ label: "Kapasitas tersedia", value: summary.availableCapacity, icon: Warehouse, tone: "emerald" },
	{ label: "Logistik kritis", value: summary.criticalLogistics, icon: AlertTriangle, tone: "rose" },
];

function distributionRoute(record: DistributionRecord, campId: string | null) {
	if (campId === record.sourceCamp.id && campId !== record.destinationCamp.id) {
		return `Keluar · ${record.destinationCamp.name}`;
	}
	if (campId === record.destinationCamp.id && campId !== record.sourceCamp.id) {
		return `Masuk · ${record.sourceCamp.name}`;
	}
	return `${record.sourceCamp.name} → ${record.destinationCamp.name}`;
}

function DistributionList({
	title,
	description,
	records,
	campId,
	emptyMessage,
	icon: Icon,
}: {
	title: string;
	description: string;
	records: DistributionRecord[];
	campId: string | null;
	emptyMessage: string;
	icon: LucideIcon;
}) {
	return (
		<section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
			<div className="mb-4 flex items-start gap-3">
				<div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon size={18} /></div>
				<div><h2 className="font-bold text-slate-950">{title}</h2><p className="text-xs text-slate-500">{description}</p></div>
			</div>
			{records.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">{emptyMessage}</p> : <div className="space-y-2">
				{records.map((record) => <div key={record.id} className="rounded-xl border border-slate-100 p-3">
					<div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-sm font-semibold text-slate-900">{record.itemName}</p><Badge label={record.status === "RECEIVED" ? "DITERIMA" : record.status === "SHIPPED" ? "DIKIRIM" : "DISIAPKAN"} /></div>
					<p className="mt-1 text-xs text-slate-600">{record.quantity} {record.unit}{record.baseQuantity && record.baseUnit ? ` · ${record.baseQuantity} ${record.baseUnit}` : ""} · {distributionRoute(record, campId)}</p>
					<p className="mt-1 text-[11px] text-slate-400">Diperbarui {new Date(record.updatedAt).toLocaleString("id-ID")}</p>
				</div>)}
			</div>}
		</section>
	);
}

export default function DashboardPage() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;
		const fetchData = () => {
			fetch("/api/dashboard", { cache: "no-store" }).then((res) => res.json()).then((data) => {
				if (cancelled) return;
				if (data.success) { setSummary(data.data.summary); setCamps(data.data.camps); }
				else setError(data.message ?? "Gagal memuat dashboard.");
			}).catch(() => { if (!cancelled) setError("Terjadi kesalahan saat memuat dashboard."); }).finally(() => { if (!cancelled) setLoading(false); });
		};
		fetchData();
		const interval = window.setInterval(fetchData, 30_000);
		return () => { cancelled = true; window.clearInterval(interval); };
	}, []);

	if (loading) return <div className="flex min-h-[50dvh] items-center justify-center text-sm text-slate-500">Memuat dashboard...</div>;

	return <div className="min-w-0 space-y-6">
		<PageHeader eyebrow={<span className="inline-flex items-center gap-2"><Activity size={14} />Command center</span>} title="Ringkasan operasional" description="Pantau kondisi posko dan sumber daya secara real-time." action={<div className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Okupansi total</p><p className="mt-1 text-xl font-bold text-slate-950">{summary?.occupancyPercentage ?? 0}%</p></div>} />
		{error && <Alert type="error">{error}</Alert>}
		{summary && <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">{stats(summary).map(({ label, value, icon: Icon, tone }) => <Card key={label} className="relative min-w-0 overflow-hidden"><div className={`absolute right-3 top-3 rounded-xl p-2 ${tone === "rose" ? "bg-rose-50 text-rose-600" : tone === "emerald" ? "bg-emerald-50 text-emerald-600" : tone === "violet" ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"}`}><Icon size={18} /></div><CardLabel>{label}</CardLabel><CardValue>{value}</CardValue><p className="mt-2 text-xs text-slate-400">Pembaruan dari data sistem</p></Card>)}</div>}
		{summary && <div className="grid min-w-0 gap-4 lg:grid-cols-2">
				<DistributionList title="Barang disiapkan" description="Permintaan yang sudah disetujui dan stoknya dicadangkan." records={summary.preparedDistributions} campId={camps.length === 1 ? camps[0].id : null} emptyMessage="Belum ada barang yang disiapkan." icon={PackageCheck} />
				<DistributionList title="Barang dikirim" description="Pengiriman berjalan dan barang yang sudah diterima." records={summary.shippedDistributions} campId={camps.length === 1 ? camps[0].id : null} emptyMessage="Belum ada barang yang dikirim." icon={Send} />
			</div>}
			<div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
			<section className="min-w-0"><div className="mb-3 flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-bold text-slate-950">Status posko</h2><p className="mt-1 text-xs text-slate-500">Kapasitas dan tingkat keterisian setiap lokasi.</p></div><Building2 size={20} className="shrink-0 text-slate-400" /></div><div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto" role="region" aria-label="Status posko" tabIndex={0}><table className="min-w-[42rem] divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Posko", "Kapasitas", "Penghuni", "Okupansi", "Status"].map((header) => <th key={header} className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-5 sm:py-3.5">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{camps.map((camp) => { const percentage = camp.maxCapacity > 0 ? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(1)) : 0; return <tr key={camp.id} className="hover:bg-slate-50"><td className="px-3 py-4 text-sm font-semibold text-slate-900 sm:px-5">{camp.name}</td><td className="px-3 py-4 text-sm text-slate-600 sm:px-5">{camp.maxCapacity}</td><td className="px-3 py-4 text-sm text-slate-600 sm:px-5">{camp.currentOccupants}</td><td className="min-w-36 px-3 py-4 sm:px-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-600"><span>{percentage}%</span><span className="text-slate-400">{camp.maxCapacity - camp.currentOccupants} sisa</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${occupancyBarClass(percentage)}`} style={{ width: `${Math.min(percentage, 100)}%` }} /></div></td><td className="px-3 py-4 sm:px-5"><Badge label={camp.status} /></td></tr>; })}</tbody></table></div></div></section>
			<section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><Boxes size={18} /></div><div><h2 className="font-bold text-slate-950">Ringkasan sumber daya</h2><p className="text-xs text-slate-500">Kondisi terkini</p></div></div>{summary && <div className="space-y-5"><div><div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">Kapasitas terisi</span><b className="text-slate-900">{summary.totalOccupants} / {summary.totalCapacity}</b></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(summary.occupancyPercentage, 100)}%` }} /></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Petugas</p><p className="mt-1 text-lg font-bold text-slate-900">{summary.staffCount}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Item logistik</p><p className="mt-1 text-lg font-bold text-slate-900">{summary.logisticsCount}</p></div><div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-600">Kritis</p><p className="mt-1 text-lg font-bold text-rose-700">{summary.criticalLogistics}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">Fasilitas</p><p className="mt-1 text-lg font-bold text-amber-700">{summary.damagedFacilities}</p></div>{summary.specialNeeds > 0 && <div className="col-span-2 rounded-xl bg-purple-50 p-3"><p className="text-xs text-purple-600">Keluarga dengan kebutuhan khusus</p><p className="mt-1 text-lg font-bold text-purple-700">{summary.specialNeeds} keluarga</p></div>}</div></div>}</section>
		</div>
	</div>;
}