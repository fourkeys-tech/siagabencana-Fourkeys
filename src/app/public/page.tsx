"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const CampMap = dynamic(
	() => import("@/components/public/camp-map").then((mod) => mod.CampMap),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
				Memuat peta...
			</div>
		),
	},
);

type Logistics = {
	id: string;
	itemName: string;
	quantity: number;
	unit: string;
	status: string;
};

type Facility = {
	id: string;
	facilityName: string;
	status: string;
};

type Camp = {
	id: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	currentOccupants: number;
	availableCapacity: number;
	occupancyPercentage: number;
	status: string;
	logistics: Logistics[];
	facilities: Facility[];
};

type Summary = {
	totalActiveCamps: number;
	totalCapacity: number;
	totalOccupants: number;
	criticalLogistics: number;
	damagedFacilities: number;
};

const statusLabels: Record<string, string> = {
	SUFFICIENT: "Cukup",
	LOW: "Menipis",
	CRITICAL: "Kritis",
	SPOILED_OR_DAMAGED: "Rusak",
	GOOD: "Baik",
	DAMAGED: "Rusak",
	REPAIRING: "Dalam Perbaikan",
	ACTIVE: "Aktif",
	CLOSED: "Ditutup",
};

function statusBadgeClass(status: string) {
	switch (status) {
		case "SUFFICIENT":
		case "GOOD":
		case "ACTIVE":
			return "bg-green-100 text-green-800";
		case "LOW":
		case "REPAIRING":
			return "bg-yellow-100 text-yellow-800";
		case "CRITICAL":
		case "DAMAGED":
		case "SPOILED_OR_DAMAGED":
			return "bg-red-100 text-red-800";
		default:
			return "bg-gray-100 text-gray-800";
	}
}

function occupancyBarClass(percentage: number) {
	if (percentage >= 90) return "bg-red-500";
	if (percentage >= 70) return "bg-yellow-500";
	return "bg-green-500";
}

export default function PublicPage() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [activeCampId, setActiveCampId] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/public/overview")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setSummary(data.data.summary);
					setCamps(data.data.camps);
				} else {
					setError("Gagal memuat data publik.");
				}
			})
			.catch(() => setError("Terjadi kesalahan saat memuat data."))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-gradient-to-br from-blue-700 to-blue-900 text-white">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
					<div className="text-lg font-bold">Siaga Bencana</div>
					<Link
						href="/login"
						className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
					>
						Masuk ke Dashboard
					</Link>
				</div>

				<div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
					<h1 className="max-w-2xl text-4xl font-bold leading-tight">
						Pemantauan Posko &amp; Logistik Bencana Secara Real-Time
					</h1>
					<p className="mt-4 max-w-xl text-blue-100">
						Pantau lokasi posko, kapasitas pengungsi, ketersediaan
						logistik, dan kondisi fasilitas tanpa harus masuk ke
						dashboard.
					</p>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-6 py-10">
				{error && (
					<div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
						{error}
					</div>
				)}

				{loading ? (
					<div className="flex h-64 items-center justify-center text-gray-500">
						Memuat data...
					</div>
				) : (
					<>
						{summary && (
							<section className="grid grid-cols-2 gap-4 md:grid-cols-5">
								<div className="rounded-xl border bg-white p-4 shadow-sm">
									<p className="text-sm text-gray-500">
										Posko Aktif
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{summary.totalActiveCamps}
									</p>
								</div>
								<div className="rounded-xl border bg-white p-4 shadow-sm">
									<p className="text-sm text-gray-500">
										Total Kapasitas
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{summary.totalCapacity}
									</p>
								</div>
								<div className="rounded-xl border bg-white p-4 shadow-sm">
									<p className="text-sm text-gray-500">
										Penghuni
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{summary.totalOccupants}
									</p>
								</div>
								<div className="rounded-xl border bg-white p-4 shadow-sm">
									<p className="text-sm text-gray-500">
										Logistik Bermasalah
									</p>
									<p className="text-2xl font-bold text-red-600">
										{summary.criticalLogistics}
									</p>
								</div>
								<div className="rounded-xl border bg-white p-4 shadow-sm">
									<p className="text-sm text-gray-500">
										Fasilitas Rusak
									</p>
									<p className="text-2xl font-bold text-yellow-600">
										{summary.damagedFacilities}
									</p>
								</div>
							</section>
						)}

						<section className="mt-10">
							<h2 className="text-xl font-semibold text-gray-900">
								Peta Lokasi Posko
							</h2>
							<div className="mt-4 h-[420px] overflow-hidden rounded-xl border bg-white shadow-sm">
								<CampMap
									camps={camps}
									activeId={activeCampId}
									onSelect={setActiveCampId}
								/>
							</div>
						</section>

						<section className="mt-10">
							<h2 className="text-xl font-semibold text-gray-900">
								Detail Posko
							</h2>
							<div className="mt-4 grid gap-6 md:grid-cols-2">
								{camps.map((camp) => (
									<div
										key={camp.id}
										id={`camp-${camp.id}`}
										className={`rounded-xl border bg-white p-5 shadow-sm transition ${
											activeCampId === camp.id
												? "ring-2 ring-blue-500"
												: ""
										}`}
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<h3 className="font-semibold text-gray-900">
													{camp.name}
												</h3>
												<p className="text-sm text-gray-500">
													{camp.address}
												</p>
											</div>
											<span
												className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(camp.status)}`}
											>
												{statusLabels[camp.status] ??
													camp.status}
											</span>
										</div>

										<div className="mt-4">
											<div className="flex justify-between text-sm text-gray-600">
												<span>
													Okupansi:{" "}
													{camp.currentOccupants}/
													{camp.maxCapacity}
												</span>
												<span>
													{camp.occupancyPercentage}%
												</span>
											</div>
											<div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
												<div
													className={`h-full rounded-full ${occupancyBarClass(camp.occupancyPercentage)}`}
													style={{
														width: `${Math.min(camp.occupancyPercentage, 100)}%`,
													}}
												/>
											</div>
											<p className="mt-1 text-xs text-gray-500">
												Sisa kapasitas:{" "}
												{camp.availableCapacity}
											</p>
										</div>

										<div className="mt-4">
											<h4 className="text-sm font-semibold text-gray-700">
												Logistik
											</h4>
											{camp.logistics.length === 0 ? (
												<p className="mt-1 text-sm text-gray-400">
													Belum ada data logistik.
												</p>
											) : (
												<ul className="mt-2 space-y-1">
													{camp.logistics.map(
														(item) => (
															<li
																key={item.id}
																className="flex items-center justify-between text-sm"
															>
																<span className="text-gray-700">
																	{item.itemName}{" "}
																	({item.quantity}{" "}
																	{item.unit})
																</span>
																<span
																	className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}
																>
																	{statusLabels[
																		item
																			.status
																	] ??
																		item.status}
																</span>
															</li>
														),
													)}
												</ul>
											)}
										</div>

										<div className="mt-4">
											<h4 className="text-sm font-semibold text-gray-700">
												Kondisi Fasilitas
											</h4>
											{camp.facilities.length === 0 ? (
												<p className="mt-1 text-sm text-gray-400">
													Belum ada laporan fasilitas.
												</p>
											) : (
												<ul className="mt-2 space-y-1">
													{camp.facilities.map(
														(facility) => (
															<li
																key={facility.id}
																className="flex items-center justify-between text-sm"
															>
																<span className="text-gray-700">
																	{
																		facility.facilityName
																	}
																</span>
																<span
																	className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(facility.status)}`}
																>
																	{statusLabels[
																		facility
																			.status
																	] ??
																		facility.status}
																</span>
															</li>
														),
													)}
												</ul>
											)}
										</div>
									</div>
								))}
							</div>
						</section>
					</>
				)}
			</main>

			<footer className="border-t bg-white">
				<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-gray-500 md:flex-row">
					<p>
						© {new Date().getFullYear()} Siaga Bencana — Data
						diperbarui oleh petugas di lapangan.
					</p>
					<Link
						href="/login"
						className="font-medium text-blue-600 hover:underline"
					>
						Masuk ke Dashboard →
					</Link>
				</div>
			</footer>
		</div>
	);
}
