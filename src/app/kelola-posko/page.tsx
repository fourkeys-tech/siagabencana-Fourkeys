"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";

interface Camp {
	id: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	currentOccupants: number;
	status: string;
}

export default function CampsPage() {
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		address: "",
		latitude: "",
		longitude: "",
		maxCapacity: "",
	});

	const loadData = useCallback(() => {
		return fetch("/api/camps")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setCamps(data.data);
				else setError(data.message ?? "Gagal memuat data posko");
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleCreate = async () => {
		try {
			const res = await fetch("/api/camps", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					latitude: Number(formData.latitude),
					longitude: Number(formData.longitude),
					maxCapacity: Number(formData.maxCapacity),
				}),
			});
			const data = await res.json();
			if (data.success) {
				setShowModal(false);
				setFormData({ name: "", address: "", latitude: "", longitude: "", maxCapacity: "" });
				loadData();
			} else {
				setError(data.message);
			}
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	const handleDelete = async (id: string, name: string) => {
		if (!confirm(`Hapus posko "${name}"?`)) return;
		try {
			const res = await fetch(`/api/camps/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) loadData();
			else setError(data.message);
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	const handleStatusToggle = async (id: string, currentStatus: string) => {
		const newStatus =
			currentStatus === "ACTIVE" ? "CLOSED" : "ACTIVE";
		try {
			const res = await fetch(`/api/camps/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: newStatus }),
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
					Kelola Posko
				</h1>
				<Button onClick={() => setShowModal(true)}>
					+ Tambah Posko
				</Button>
			</div>

			{error && (
				<Alert type="error">{error}</Alert>
			)}

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
									Nama
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Alamat
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Kapasitas
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Status
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Aksi
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
										{camp.address}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{camp.maxCapacity}
									</td>
									<td className="px-6 py-4">
										<Badge label={camp.status} />
									</td>
									<td className="px-6 py-4 text-sm">
										<button
											onClick={() =>
												handleStatusToggle(
													camp.id,
													camp.status,
												)
											}
											className="text-blue-600 hover:underline mr-3"
										>
											Toggle Status
										</button>
										<button
											onClick={() =>
												handleDelete(
													camp.id,
													camp.name,
												)
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
				title="Tambah Posko"
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleCreate();
					}}
					className="space-y-3"
				>
					<FormField
						label="Nama"
						value={formData.name}
						onChange={(v) =>
							setFormData({ ...formData, name: v })
						}
						placeholder="Nama posko"
						required
					/>
					<FormField
						label="Alamat"
						value={formData.address}
						onChange={(v) =>
							setFormData({ ...formData, address: v })
						}
						placeholder="Alamat posko"
					/>
					<FormField
						label="Latitude"
						type="number"
						step="0.0001"
						value={formData.latitude}
						onChange={(v) =>
							setFormData({ ...formData, latitude: v })
						}
						placeholder="-7.4716"
					/>
					<FormField
						label="Longitude"
						type="number"
						step="0.0001"
						value={formData.longitude}
						onChange={(v) =>
							setFormData({ ...formData, longitude: v })
						}
						placeholder="112.6946"
					/>
					<FormField
						label="Max Kapasitas"
						type="number"
						value={formData.maxCapacity}
						onChange={(v) =>
							setFormData({
								...formData,
								maxCapacity: v,
							})
						}
						placeholder="200"
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
