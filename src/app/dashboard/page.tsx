"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Activity, AlertTriangle, Boxes, Building2, ChevronRight, ClipboardList, PackageCheck, Send, Users, Warehouse, type LucideIcon } from "lucide-react";
import { useSession } from "@/components/auth/user-provider";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessPath } from "@/lib/navigation";
import { occupancyBarClass } from "@/lib/occupancy";
import { usePolling } from "@/lib/use-polling";

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
interface Summary { totalCamps: number; activeCamps: number; totalCapacity: number; totalOccupants: number; availableCapacity: number; occupancyPercentage: number; activePeople: number; activeFamilies: number; specialNeeds: number; staffCount: number; }
interface Camp { id: string; name: string; maxCapacity: number; currentOccupants: number; availableCapacity: number; occupancyPercentage: number; status: string; }
interface ActionItem { key: string; label: string; description: string; count: number; href: string; tone: "danger" | "warning" | "info"; }
interface DashboardData {
	scope: { logistics: boolean; shelter: boolean; registration: boolean; distribution: boolean };
	hasCampAssignment: boolean;
	summary: Summary;
	logistics: { total: number; problem: number; critical: number } | null;
	facilities: { total: number; problem: number; damaged: number } | null;
	distributions: { prepared: DistributionRecord[]; shipped: DistributionRecord[] } | null;
	actionItems: ActionItem[];
	camps: Camp[];
}

type Stat = { label: string; value: number; hint: string; icon: LucideIcon; tone: "blue" | "violet" | "emerald" | "rose"; href: string };

const POLL_INTERVAL_MS = 30_000;

const toneClass: Record<Stat["tone"], string> = {
	blue: "bg-blue-50 text-blue-600",
	violet: "bg-violet-50 text-violet-600",
	emerald: "bg-emerald-50 text-emerald-600",
	rose: "bg-rose-50 text-rose-600",
};

const actionToneClass: Record<ActionItem["tone"], string> = {
	danger: "border-rose-200 bg-rose-50 text-rose-700",
	warning: "border-amber-200 bg-amber-50 text-amber-700",
	info: "border-blue-200 bg-blue-50 text-blue-700",
};

function buildStats(data: DashboardData): Stat[] {
	const { summary } = data;
	const stats: Stat[] = [
		{ label: "Posko aktif", value: summary.activeCamps, hint: `${summary.totalCamps} posko terdaftar`, icon: Building2, tone: "blue", href: "/monitoring" },
		{ label: "Pengungsi aktif", value: summary.activePeople, hint: `jiwa · ${summary.activeFamilies} KK tercatat`, icon: Users, tone: "violet", href: "/pengungsi" },
		{ label: "Kapasitas tersedia", value: summary.availableCapacity, hint: "jiwa di posko aktif", icon: Warehouse, tone: "emerald", href: "/monitoring" },
	];
	if (data.logistics) stats.push({ label: "Logistik bermasalah", value: data.logistics.problem, hint: `${data.logistics.critical} kritis / rusak`, icon: AlertTriangle, tone: "rose", href: "/logistik" });
	return stats;
}

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

function ActionPanel({ items }: { items: ActionItem[] }) {
	return (
		<section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Perlu tindakan">
			<div className="mb-4 flex items-start gap-3">
				<div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><ClipboardList size={18} /></div>
				<div><h2 className="font-bold text-slate-950">Perlu tindakan</h2><p className="text-xs text-slate-500">Tugas yang menunggu Anda berdasarkan peran dan posko.</p></div>
			</div>
			{items.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">Tidak ada tugas yang menunggu. Semua beres.</p> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
				{items.map((item) => <Link key={item.key} href={item.href} className={`group flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm ${actionToneClass[item.tone]}`}>
					<span className="text-2xl font-bold tabular-nums">{item.count}</span>
					<span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block text-xs opacity-80">{item.description}</span></span>
					<ChevronRight size={16} className="shrink-0 opacity-60 transition group-hover:translate-x-0.5" />
				</Link>)}
			</div>}
		</section>
	);
}

export default function DashboardPage() {
	const { user, refresh } = useSession();
	const [data, setData] = useState<DashboardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const fetchData = useCallback(async () => {
		try {
			const response = await fetch("/api/dashboard", { cache: "no-store" });
			if (response.status === 401) { await refresh(); return; }
			const result = await response.json();
			if (response.ok && result.success) { setData(result.data); setError(""); }
			else setError(result.message ?? "Gagal memuat dashboard.");
		} catch {
			setError("Terjadi kesalahan saat memuat dashboard.");
		} finally {
			setLoading(false);
		}
	}, [refresh]);

	usePolling(fetchData, POLL_INTERVAL_MS);

	if (loading) return <div className="flex min-h-[50dvh] items-center justify-center text-sm text-slate-500">Memuat dashboard...</div>;

	const campId = user?.campId ?? null;
	const summary = data?.summary;

	return <div className="min-w-0 space-y-6">
		<PageHeader eyebrow={<span className="inline-flex items-center gap-2"><Activity size={14} />Command center</span>} title="Ringkasan operasional" description="Pantau kondisi posko dan sumber daya secara real-time." action={<div className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Okupansi posko aktif</p><p className="mt-1 text-xl font-bold text-slate-950">{summary?.occupancyPercentage ?? 0}%</p></div>} />
		{error && <Alert type="error">{error}</Alert>}
		{data && !data.hasCampAssignment && <Alert type="warning">Akun Anda belum ditugaskan ke posko. Hubungi Super Admin atau Manager agar data operasional posko tampil.</Alert>}
		{data && <ActionPanel items={data.actionItems} />}
		{data && summary && <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">{buildStats(data).map(({ label, value, hint, icon: Icon, tone, href }) => {
			const content = <><div className={`absolute right-3 top-3 rounded-xl p-2 ${toneClass[tone]}`}><Icon size={18} /></div><CardLabel>{label}</CardLabel><CardValue>{value}</CardValue><p className="mt-2 text-xs text-slate-400">{hint}</p></>;
			return canAccessPath(href, user)
				? <Link key={label} href={href} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-blue-500"><Card className="relative h-full min-w-0 overflow-hidden transition hover:border-blue-200 hover:shadow-md">{content}</Card></Link>
				: <Card key={label} className="relative min-w-0 overflow-hidden">{content}</Card>;
		})}</div>}
		{data?.distributions && <div className="grid min-w-0 gap-4 lg:grid-cols-2">
			<DistributionList title="Barang disiapkan" description="Permintaan yang sudah disetujui dan stoknya dicadangkan." records={data.distributions.prepared} campId={campId} emptyMessage="Belum ada barang yang disiapkan." icon={PackageCheck} />
			<DistributionList title="Barang dikirim" description="Pengiriman berjalan dan barang yang sudah diterima." records={data.distributions.shipped} campId={campId} emptyMessage="Belum ada barang yang dikirim." icon={Send} />
		</div>}
		{data && <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
			<section className="min-w-0"><div className="mb-3 flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-bold text-slate-950">Status posko</h2><p className="mt-1 text-xs text-slate-500">Kapasitas dan tingkat keterisian setiap lokasi.</p></div><Building2 size={20} className="shrink-0 text-slate-400" /></div><div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto" role="region" aria-label="Status posko" tabIndex={0}><table className="min-w-[42rem] divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Posko", "Kapasitas", "Penghuni", "Okupansi", "Status"].map((header) => <th key={header} className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-5 sm:py-3.5">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.camps.length === 0 ? <tr><td colSpan={5} className="px-5 py-6 text-center text-xs text-slate-500">Belum ada posko yang dapat Anda akses.</td></tr> : data.camps.map((camp) => <tr key={camp.id} className="hover:bg-slate-50"><td className="px-3 py-4 text-sm font-semibold text-slate-900 sm:px-5">{camp.name}</td><td className="px-3 py-4 text-sm text-slate-600 sm:px-5">{camp.maxCapacity}</td><td className="px-3 py-4 text-sm text-slate-600 sm:px-5">{camp.currentOccupants}</td><td className="min-w-36 px-3 py-4 sm:px-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-600"><span>{camp.occupancyPercentage}%</span><span className="text-slate-400">{camp.availableCapacity} sisa</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${occupancyBarClass(camp.occupancyPercentage)}`} style={{ width: `${Math.min(camp.occupancyPercentage, 100)}%` }} /></div></td><td className="px-3 py-4 sm:px-5"><Badge label={camp.status} /></td></tr>)}</tbody></table></div></div></section>
			<section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><Boxes size={18} /></div><div><h2 className="font-bold text-slate-950">Ringkasan sumber daya</h2><p className="text-xs text-slate-500">Kondisi terkini posko aktif</p></div></div>{summary && <div className="space-y-5"><div><div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">Kapasitas terisi</span><b className="text-slate-900">{summary.totalOccupants} / {summary.totalCapacity}</b></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(summary.occupancyPercentage, 100)}%` }} /></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Petugas</p><p className="mt-1 text-lg font-bold text-slate-900">{summary.staffCount}</p></div>{data.logistics && <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Item logistik</p><p className="mt-1 text-lg font-bold text-slate-900">{data.logistics.total}</p></div>}{data.logistics && <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-600">Logistik kritis</p><p className="mt-1 text-lg font-bold text-rose-700">{data.logistics.critical}</p></div>}{data.facilities && <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">Fasilitas bermasalah</p><p className="mt-1 text-lg font-bold text-amber-700">{data.facilities.problem}</p></div>}{summary.specialNeeds > 0 && <div className="col-span-2 rounded-xl bg-purple-50 p-3"><p className="text-xs text-purple-600">Keluarga dengan kebutuhan khusus</p><p className="mt-1 text-lg font-bold text-purple-700">{summary.specialNeeds} keluarga</p></div>}</div></div>}</section>
		</div>}
	</div>;
}
