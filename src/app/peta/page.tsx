"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { occupancyBarClass } from "@/lib/occupancy";
import { apiGet } from "@/lib/api-client";
import { usePolling } from "@/lib/use-polling";
import type { MapCamp } from "@/components/public/camp-map";

const CampMap = dynamic(
	() => import("@/components/public/camp-map").then((mod) => mod.CampMap),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full items-center justify-center text-gray-500">
				Muat peta...
			</div>
		),
	},
);

type MonitoringCamp = MapCamp & {
	problemLogistics: number;
	problemFacilities: number;
	activeEvacuees: number;
};

interface MonitoringResponseData {
	camps: MonitoringCamp[];
}

export default function PetaPage() {
	const [camps, setCamps] = useState<MonitoringCamp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [activeId, setActiveId] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		const res = await apiGet<MonitoringResponseData>("/api/monitoring");
		if (res.ok && res.data) {
			setCamps(res.data.camps);
			setError("");
		} else {
			setError(res.message ?? "Gagal memuat data peta.");
		}
		setLoading(false);
	}, []);

	usePolling(loadData, 30_000);

	const popupExtra = useMemo(() => {
		return (camp: MapCamp) => {
			const detail = camps.find((item) => item.id === camp.id);

			if (!detail) return "";

			return `
				<p style="margin:4px 0">
					Logistik bermasalah: ${detail.problemLogistics}
				</p>
				<p style="margin:4px 0">
					Fasilitas bermasalah: ${detail.problemFacilities}
				</p>
				<p style="margin:4px 0">
					Pengungsi aktif: ${detail.activeEvacuees}
				</p>
			`;
		};
	}, [camps]);

	if (loading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<span className="text-lg text-gray-500">Memuat...</span>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-2xl font-bold text-gray-900">
					Peta Bencana
				</h1>
				{error && (
					<Button variant="secondary" onClick={() => void loadData()}>
						Coba Lagi
					</Button>
				)}
			</div>

			{error && <Alert type="error">{error}</Alert>}

			<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
				<div className="max-h-72 min-w-0 overflow-y-auto lg:max-h-[600px]">
					<Card className="p-0">
						{camps.length === 0 ? (
							<p className="p-4 text-sm text-gray-500">
								{error ? "Data posko tidak dapat dimuat." : "Belum ada data posko."}
							</p>
						) : (
							<ul className="divide-y divide-gray-100">
								{camps.map((camp) => (
									<li key={camp.id}>
										<button
											type="button"
											onClick={() => setActiveId(camp.id)}
											className={`w-full px-4 py-3 text-left transition-colors ${
												activeId === camp.id
													? "bg-blue-50"
													: "hover:bg-gray-50"
											}`}
										>
											<div className="flex items-center justify-between gap-2">
												<span className="text-sm font-medium text-gray-900">
													{camp.name}
												</span>

												<span className="text-xs font-semibold text-gray-700">
													{camp.occupancyPercentage}%
												</span>
											</div>

											<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
												<div
													className={`h-full rounded-full ${occupancyBarClass(
														camp.occupancyPercentage,
													)}`}
													style={{
														width: `${Math.min(
															camp.occupancyPercentage,
															100,
														)}%`,
													}}
												/>
											</div>

											<div className="mt-2 flex flex-wrap items-center gap-2">
												<Badge label={camp.status} />

												{camp.problemLogistics > 0 && (
													<Badge label="CRITICAL" />
												)}
											</div>
										</button>
									</li>
								))}
							</ul>
						)}
					</Card>
				</div>

				<div className="h-[min(70dvh,600px)] min-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-white">
					<CampMap
						camps={camps}
						activeId={activeId}
						onSelect={setActiveId}
						popupExtra={popupExtra}
					/>
				</div>
			</div>
		</div>
	);
}
