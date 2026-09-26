"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Summary {
	totalCamps: number;
	totalCapacity: number;
	totalOccupants: number;
	availableCapacity: number;
	occupancyPercentage: number;
	staffCount: number;
	logisticsCount: number;
	criticalLogistics: number;
	damagedFacilities: number;
	specialNeeds: number;
	activeEvacuees: number;
}

interface Camp {
	id: string;
	name: string;
	maxCapacity: number;
	currentOccupants: number;
	status: string;
}

export default function DashboardPage() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch("/api/dashboard")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setSummary(data.data.summary);
					setCamps(data.data.camps);
				} else {
					setError("Gagal memuat dashboard");
				}
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<span className="text-gray-500 text-lg">
					Memuat...
				</span>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">
				Dashboard
			</h1>

			{error && (
				<Alert type="error">{error}</Alert>
			)}

			{summary && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Total Posko
						</p>
						<p className="text-2xl font-bold">
							{summary.totalCamps}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Kapasitas Total
						</p>
						<p className="text-2xl font-bold">
							{summary.totalCapacity}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Penghuni Aktif
						</p>
						<p className="text-2xl font-bold">
							{summary.totalOccupants}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Kapasitas Tersedia
						</p>
						<p className="text-2xl font-bold text-green-600">
							{summary.availableCapacity}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							% Penempatan
						</p>
						<p className="text-2xl font-bold">
							{summary.occupancyPercentage}%
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Petugas
						</p>
						<p className="text-2xl font-bold">
							{summary.staffCount}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Barang Logistik
						</p>
						<p className="text-2xl font-bold">
							{summary.logisticsCount}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Logistik Kritis
						</p>
						<p className="text-2xl font-bold text-red-600">
							{summary.criticalLogistics}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Fasilitas Rusak
						</p>
						<p className="text-2xl font-bold text-yellow-600">
							{summary.damagedFacilities}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Pengungsi Butuh Khusus
						</p>
						<p className="text-2xl font-bold">
							{summary.specialNeeds}
						</p>
					</div>
					<div className="bg-white p-4 rounded-lg border shadow-sm">
						<p className="text-sm text-gray-500">
							Pengungsi Aktif
						</p>
						<p className="text-2xl font-bold">
							{summary.activeEvacuees}
						</p>
					</div>
				</div>
			)}

			<div>
				<h2 className="text-xl font-semibold mb-4">
					Daftar Posko
				</h2>
				<div className="bg-white rounded-lg border">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Nama
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Kapasitas
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Penghuni
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{camps.map((camp) => (
								<tr key={camp.id} className="hover:bg-gray-50">
									<td className="px-6 py-4 text-sm font-medium text-gray-900">
										{camp.name}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{camp.maxCapacity}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{camp.currentOccupants}
									</td>
									<td className="px-6 py-4">
										<Badge
											label={camp.status}
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
