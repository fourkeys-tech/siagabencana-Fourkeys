"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Boxes, Building2, Users, Warehouse } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
import { occupancyBarClass } from "@/lib/occupancy";

interface Summary { totalCamps: number; totalCapacity: number; totalOccupants: number; availableCapacity: number; occupancyPercentage: number; staffCount: number; logisticsCount: number; criticalLogistics: number; damagedFacilities: number; specialNeeds: number; activeEvacuees: number; }
interface Camp { id: string; name: string; maxCapacity: number; currentOccupants: number; status: string; }

const stats = (summary: Summary) => [
	{ label: "Posko terdaftar", value: summary.totalCamps, icon: Building2, tone: "blue" },
	{ label: "Pengungsi aktif", value: summary.activeEvacuees, icon: Users, tone: "violet" },
	{ label: "Kapasitas tersedia", value: summary.availableCapacity, icon: Warehouse, tone: "emerald" },
	{ label: "Logistik kritis", value: summary.criticalLogistics, icon: AlertTriangle, tone: "rose" },
];

export default function DashboardPage() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => { fetch("/api/dashboard").then((res) => res.json()).then((data) => { if (data.success) { setSummary(data.data.summary); setCamps(data.data.camps); } else setError(data.message ?? "Gagal memuat dashboard."); }).catch(() => setError("Terjadi kesalahan saat memuat dashboard.")).finally(() => setLoading(false)); }, []);

	if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Memuat dashboard...</div>;

	return <div className="space-y-6">
		<div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600"><Activity size={14} />Command center</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Ringkasan operasional</h1><p className="mt-2 text-sm text-slate-500">Pantau kondisi posko dan sumber daya secara real-time.</p></div><div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Okupansi total</p><p className="mt-1 text-xl font-bold text-slate-950">{summary?.occupancyPercentage ?? 0}%</p></div></div>
		{error && <Alert type="error">{error}</Alert>}
		{summary && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats(summary).map(({ label, value, icon: Icon, tone }) => <Card key={label} className="relative overflow-hidden"><div className={`absolute right-4 top-4 rounded-xl p-2.5 ${tone === "rose" ? "bg-rose-50 text-rose-600" : tone === "emerald" ? "bg-emerald-50 text-emerald-600" : tone === "violet" ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"}`}><Icon size={18} /></div><CardLabel>{label}</CardLabel><CardValue>{value}</CardValue><p className="mt-2 text-xs text-slate-400">Pembaruan dari data sistem</p></Card>)}</div>}
		<div className="grid gap-6 xl:grid-cols-[1fr_340px]">
			<section><div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-950">Status posko</h2><p className="mt-1 text-xs text-slate-500">Kapasitas dan tingkat keterisian setiap lokasi.</p></div><Building2 size={20} className="text-slate-400" /></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Posko", "Kapasitas", "Penghuni", "Okupansi", "Status"].map((header) => <th key={header} className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{camps.map((camp) => { const percentage = camp.maxCapacity > 0 ? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(1)) : 0; return <tr key={camp.id} className="hover:bg-slate-50"><td className="px-5 py-4 text-sm font-semibold text-slate-900">{camp.name}</td><td className="px-5 py-4 text-sm text-slate-600">{camp.maxCapacity}</td><td className="px-5 py-4 text-sm text-slate-600">{camp.currentOccupants}</td><td className="min-w-36 px-5 py-4"><div className="flex items-center justify-between text-xs font-semibold text-slate-600"><span>{percentage}%</span><span className="text-slate-400">{camp.maxCapacity - camp.currentOccupants} sisa</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${occupancyBarClass(percentage)}`} style={{ width: `${Math.min(percentage, 100)}%` }} /></div></td><td className="px-5 py-4"><Badge label={camp.status} /></td></tr>; })}</tbody></table></div></div></section>
			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><Boxes size={18} /></div><div><h2 className="font-bold text-slate-950">Ringkasan sumber daya</h2><p className="text-xs text-slate-500">Kondisi terkini</p></div></div>{summary && <div className="space-y-5"><div><div className="flex justify-between text-sm"><span className="text-slate-600">Kapasitas terisi</span><b className="text-slate-900">{summary.totalOccupants} / {summary.totalCapacity}</b></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(summary.occupancyPercentage, 100)}%` }} /></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Petugas</p><p className="mt-1 text-lg font-bold text-slate-900">{summary.staffCount}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Item logistik</p><p className="mt-1 text-lg font-bold text-slate-900">{summary.logisticsCount}</p></div><div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-600">Kritis</p><p className="mt-1 text-lg font-bold text-rose-700">{summary.criticalLogistics}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">Fasilitas</p><p className="mt-1 text-lg font-bold text-amber-700">{summary.damagedFacilities}</p></div></div></div>}</section>
		</div>
	</div>;
}
