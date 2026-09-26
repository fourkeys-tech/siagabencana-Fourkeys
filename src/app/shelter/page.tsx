"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface FacilityReport {
	id: string;
	campId: string;
	camp: { name: string };
	facilityName: string;
	status: string;
	description: string;
}

interface Camp {
	id: string;
	name: string;
}

export default function ShelterPage() {
	const [reports, setReports] = useState<FacilityReport[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		campId: "",
		facilityName: "",
		status: "GOOD",
		description: "",
	});

	const loadData = useCallback(() => {
		return fetch("/api/shelter")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setReports(data.data);
				else setError(data.message ?? "Gagal memuat data");
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		loadData();
		fetch("/api/public/camps")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setCamps(data.data);
			})
			.catch(() => {});
	}, [loadData]);

	const handleCreate = async () => {
		try {
			const res = await fetch("/api/shelter", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					campId: formData.campId,
					facilityName: formData.facilityName,
					status: formData.status,
					description: formData.description,
				}),
			});
			const data = await res.json();
			if (data.success) {
				setShowModal(false);
				setFormData({
					campId: "",
					facilityName: "",
					status: "GOOD",
					description: "",
				});
				loadData();
			} else {
				setError(data.message);
			}
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus laporan ini?")) return;
		try {
			const res = await fetch(`/api/shelter/${id}`, {
				method: "DELETE",
			});
			const data = await res.json();
			if (data.success) loadData();
			else setError(data.message);
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">
					Laporan Shelter
				</h1>
				<Button onClick={() => setShowModal(true)}>
					+ Tambah Laporan
				</Button>
			</div>

			{error && <Alert type="error">{error}</Alert>}

			{loading ? (
				<div className="flex items-center justify-center h-64">
					<span className="text-gray-500">Memuat...</span>
				</div>
			) : (
				<div className="bg-white rounded-lg border overflow-hidden">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Fasilitas
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Status
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Deskripsi
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Posko
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Aksi
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{reports.map((report) => (
								<tr key={report.id} className="hover:bg-gray-50">
									<td className="px-6 py-4 text-sm font-medium text-gray-900">
										{report.facilityName}
									</td>
									<td className="px-6 py-4">
										<Badge label={report.status} />
									</td>
									<td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
										{report.description}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{report.camp?.name}
									</td>
									<td className="px-6 py-4 text-sm">
										<button
											onClick={() =>
												handleDelete(report.id)
											}
											className="text-red-600 hover:underline"
										>
											Hapus
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<Modal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title="Tambah Laporan Shelter"
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleCreate();
					}}
					className="space-y-3"
				>
					<FormSelect
						label="Posko"
						value={formData.campId}
						onChange={(v) =>
							setFormData({ ...formData, campId: v })
						}
						options={[
							{ value: "", label: "Pilih Posko" },
							...camps.map((camp) => ({
								value: camp.id,
								label: camp.name,
							})),
						]}
						required
					/>
					<FormField
						label="Nama Fasilitas"
						value={formData.facilityName}
						onChange={(v) =>
							setFormData({ ...formData, facilityName: v })
						}
						placeholder="Nama fasilitas"
						required
					/>
					<FormSelect
						label="Status"
						value={formData.status}
						onChange={(v) =>
							setFormData({ ...formData, status: v })
						}
						options={[
							{ value: "GOOD", label: "Baik" },
							{ value: "DAMAGED", label: "Rusak" },
							{ value: "REPAIRING", label: "Dalam Perbaikan" },
						]}
					/>
					<FormField
						label="Deskripsi"
						value={formData.description}
						onChange={(v) =>
							setFormData({ ...formData, description: v })
						}
						placeholder="Deskripsi kondisi fasilitas"
						required
					/>
					<div className="flex gap-2 justify-end mt-4">
						<Button
							type="button"
							variant="secondary"
							onClick={() => setShowModal(false)}
						>
							Batal
						</Button>
						<Button type="submit">Simpan</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
