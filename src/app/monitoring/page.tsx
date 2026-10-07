"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Building2, PackageSearch, UsersRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
import { occupancyBarClass } from "@/lib/occupancy";

interface Summary { activeCamps: number; totalCamps: number; totalCapacity: number; totalOccupants: number; occupancyPercentage: number; criticalLogistics: number; damagedFacilities: number; warningCount: number; }
interface Warning { type: "OCCUPANCY" | "LOGISTICS" | "FACILITY"; campId: string; campName: string; message: string; count: number; }
interface Camp { id: string; name: string; status: string; maxCapacity: number; currentOccupants: number; availableCapacity: number; occupancyPercentage: number; activeEvacuees: number; logisticsTotal: number; problemLogistics: number; problemFacilities: number; }

const warningTypes: Record<Warning["type"], "error" | "warning"> = { OCCUPANCY: "error", LOGISTICS: "error", FACILITY: "warning" };

export default function MonitoringPage() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [warnings, setWarnings] = useState<Warning[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => { fetch("/api/monitoring").then((res) => res.json()).then((data) => { if (data.success) { setSummary(data.data.summary); setWarnings(data.data.warnings); setCamps(data.data.camps); } else setError(data.message ?? "Gagal memuat monitoring."); }).catch(() => setError("Terjadi kesalahan saat memuat monitoring.")).finally(() => setLoading(false)); }, []);

	if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Memuat monitoring...</div>;

	return <div className="space-y-6"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600"><Building2 size={14} />Operational intelligence</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Monitoring lapangan</h1><p className="mt-2 text-sm text-slate-500">Identifikasi risiko kapasitas, logistik, dan fasilitas dari satu tampilan.</p></div>{error && <Alert type="error">{error}</Alert>}{summary && <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4"><Card><div className="mb-4 flex items-center justify-between"><CardLabel>Posko aktif</CardLabel><Building2 size={18} className="text-blue-500" /></div><CardValue>{summary.activeCamps}<span className="ml-1 text-base font-medium text-slate-400">/ {summary.totalCamps}</span></CardValue></Card><Card><div className="mb-4 flex items-center justify-between"><CardLabel>Penghuni</CardLabel><UsersRound size={18} className="text-violet-500" /></div><CardValue>{summary.totalOccupants}</CardValue></Card><Card><div className="mb-4 flex items-center justify-between"><CardLabel>Okupansi</CardLabel><PackageSearch size={18} className="text-emerald-500" /></div><CardValue>{summary.occupancyPercentage}%</CardValue></Card><Card><div className="mb-4 flex items-center justify-between"><CardLabel>Peringatan</CardLabel><AlertTriangle size={18} className="text-rose-500" /></div><CardValue className="text-rose-600">{summary.warningCount}</CardValue></Card></div>}
		<section><div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-bold text-slate-950">Peringatan prioritas</h2><p className="mt-1 text-xs text-slate-500">Tindakan yang perlu ditinjau oleh tim operasional.</p></div></div><Card>{warnings.length === 0 ? <Alert type="success">Tidak ada peringatan aktif saat ini.</Alert> : <div className="space-y-3">{warnings.map((warning, index) => <Alert key={`${warning.campId}-${warning.type}-${index}`} type={warningTypes[warning.type]}><span className="font-semibold">{warning.message}</span></Alert>)}</div>}</Card></section>
		<section><div className="mb-3"><h2 className="text-lg font-bold text-slate-950">Status seluruh posko</h2><p className="mt-1 text-xs text-slate-500">Gunakan indikator okupansi untuk menentukan prioritas respons.</p></div><Card className="min-w-0 p-0"><div className="divide-y divide-slate-100">{camps.length === 0 ? <p className="p-5 text-sm text-slate-500">Belum ada data posko.</p> : camps.map((camp) => <div key={camp.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">{camp.name.slice(0, 1)}</div><div><p className="font-semibold text-slate-900">{camp.name}</p><div className="mt-1 flex flex-wrap gap-2"><Badge label={camp.status} />{camp.problemLogistics > 0 && <Badge label="CRITICAL" />}</div></div></div><p className="text-lg font-bold text-slate-900">{camp.occupancyPercentage}%</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${occupancyBarClass(camp.occupancyPercentage)}`} style={{ width: `${Math.min(camp.occupancyPercentage, 100)}%` }} /></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>Penghuni {camp.currentOccupants}/{camp.maxCapacity}</span><span>Sisa {camp.availableCapacity}</span><span>Pengungsi aktif {camp.activeEvacuees}</span><span className={camp.problemLogistics > 0 ? "font-semibold text-rose-600" : ""}>Logistik bermasalah {camp.problemLogistics}/{camp.logisticsTotal}</span><span className={camp.problemFacilities > 0 ? "font-semibold text-amber-600" : ""}>Fasilitas bermasalah {camp.problemFacilities}</span></div></div>)}</div></Card></section>
	</div>;
}
