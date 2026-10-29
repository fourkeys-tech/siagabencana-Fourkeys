"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Building2, PackageSearch, RefreshCw, UsersRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
import { occupancyBarClass } from "@/lib/occupancy";
import { apiGet } from "@/lib/api-client";
import { usePolling } from "@/lib/use-polling";

interface Summary {
	activeCamps: number;
	totalCamps: number;
	totalCapacity: number;
	totalOccupants: number;
	occupancyPercentage: number;
	criticalLogistics: number;
	damagedFacilities: number;
	warningCount: number;
}

interface Warning {
	type: "OCCUPANCY" | "LOGISTICS" | "FACILITY";
	campId: string;
	campName: string;
	message: string;
	count: number;
}

interface Camp {
	id: string;
	name: string;
	status: string;
	maxCapacity: number;
	currentOccupants: number;
	availableCapacity: number;
	occupancyPercentage: number;
	activeEvacuees: number;
	logisticsTotal: number;
	problemLogistics: number;
	problemFacilities: number;
}

interface MonitoringResponseData {
	summary: Summary;
	warnings: Warning[];
	camps: Camp[];
}

const warningTypes: Record<Warning["type"], "error" | "warning"> = {
	OCCUPANCY: "error",
	LOGISTICS: "error",
	FACILITY: "warning",
};

export default function MonitoringPage() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [warnings, setWarnings] = useState<Warning[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [initialLoading, setInitialLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");

	const loadData = useCallback(async () => {
		setRefreshing(true);
		const res = await apiGet<MonitoringResponseData>("/api/monitoring");
		if (res.ok && res.data) {
			setSummary(res.data.summary);
			setWarnings(res.data.warnings);
			setCamps(res.data.camps);
			setError("");
		} else {
			setError(res.message ?? "Gagal memuat monitoring.");
		}
		setInitialLoading(false);
		setRefreshing(false);
	}, []);

	usePolling(loadData, 30_000);

	if (initialLoading) {
		return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">Memuat monitoring...</div>;
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
						<Building2 size={14} />Operational intelligence
					</div>
					<h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Monitoring lapangan</h1>
					<p className="mt-2 text-sm text-slate-500">Identifikasi risiko kapasitas, logistik, dan fasilitas dari satu tampilan.</p>
				</div>
				<Button
					variant="secondary"
					onClick={() => void loadData()}
					disabled={refreshing}
					className="self-start sm:self-auto"
				>
					<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
					{refreshing ? "Memperbarui..." : "Perbarui"}
				</Button>
			</div>

			{error && (
				<div className="space-y-2">
					<Alert type="error">{error}</Alert>
					<Button variant="secondary" onClick={() => void loadData()}>Coba Lagi</Button>
				</div>
			)}

			{summary && (
				<div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">
					<Card>
						<div className="mb-4 flex items-center justify-between">
							<CardLabel>Posko aktif</CardLabel>
							<Building2 size={18} className="text-blue-500" />
						</div>
						<CardValue>{summary.activeCamps}<span className="ml-1 text-base font-medium text-slate-400">/ {summary.totalCamps}</span></CardValue>
					</Card>
					<Card>
						<div className="mb-4 flex items-center justify-between">
							<CardLabel>Penghuni</CardLabel>
							<UsersRound size={18} className="text-violet-500" />
						</div>
						<CardValue>{summary.totalOccupants}</CardValue>
					</Card>
					<Card>
						<div className="mb-4 flex items-center justify-between">
							<CardLabel>Okupansi</CardLabel>
							<PackageSearch size={18} className="text-emerald-500" />
						</div>
						<CardValue>{summary.occupancyPercentage}%</CardValue>
					</Card>
					<Card>
						<div className="mb-4 flex items-center justify-between">
							<CardLabel>Peringatan</CardLabel>
							<AlertTriangle size={18} className="text-rose-500" />
						</div>
						<CardValue className="text-rose-600">{summary.warningCount}</CardValue>
					</Card>
				</div>
			)}

			{!error && (
				<section>
					<div className="mb-3 flex items-end justify-between">
						<div>
							<h2 className="text-lg font-bold text-slate-950">Peringatan prioritas</h2>
							<p className="mt-1 text-xs text-slate-500">Tindakan yang perlu ditinjau oleh tim operasional.</p>
						</div>
					</div>
					<Card>
						{warnings.length === 0 ? (
							<Alert type="success">Tidak ada peringatan aktif saat ini.</Alert>
						) : (
							<div className="space-y-3">
								{warnings.map((warning, index) => (
									<Alert key={`${warning.campId}-${warning.type}-${index}`} type={warningTypes[warning.type]}>
										<span className="font-semibold">{warning.message}</span>
									</Alert>
								))}
							</div>
						)}
					</Card>
				</section>
			)}

			<section>
				<div className="mb-3">
					<h2 className="text-lg font-bold text-slate-950">Status seluruh posko</h2>
					<p className="mt-1 text-xs text-slate-500">Gunakan indikator okupansi untuk menentukan prioritas respons.</p>
				</div>
				<Card className="min-w-0 p-0">
					<div className="divide-y divide-slate-100">
						{camps.length === 0 ? (
							<p className="p-5 text-sm text-slate-500">{error ? "Data posko tidak dapat dimuat." : "Belum ada data posko."}</p>
						) : (
							camps.map((camp) => (
								<div key={camp.id} className="p-5">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div className="flex items-center gap-3">
											<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
												{camp.name.slice(0, 1)}
											</div>
											<div>
												<p className="font-semibold text-slate-900">{camp.name}</p>
												<div className="mt-1 flex flex-wrap gap-2">
													<Badge label={camp.status} />
													{camp.problemLogistics > 0 && <Badge label="CRITICAL" />}
												</div>
											</div>
										</div>
										<p className="text-lg font-bold text-slate-900">{camp.occupancyPercentage}%</p>
									</div>
									<div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
										<div
											className={`h-full rounded-full ${occupancyBarClass(camp.occupancyPercentage)}`}
											style={{ width: `${Math.min(camp.occupancyPercentage, 100)}%` }}
										/>
									</div>
									<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
										<span>Penghuni {camp.currentOccupants}/{camp.maxCapacity}</span>
										<span>Sisa {camp.availableCapacity}</span>
										<span>Pengungsi aktif {camp.activeEvacuees}</span>
										<span className={camp.problemLogistics > 0 ? "font-semibold text-rose-600" : ""}>
											Logistik bermasalah {camp.problemLogistics}/{camp.logisticsTotal}
										</span>
										<span className={camp.problemFacilities > 0 ? "font-semibold text-amber-600" : ""}>
											Fasilitas bermasalah {camp.problemFacilities}
										</span>
									</div>
								</div>
							))
						)}
					</div>
				</Card>
			</section>
		</div>
	);
}
