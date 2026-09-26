"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface LogisticsItem {
	id: string;
	campId: string;
	camp: { name: string };
	itemName: string;
	quantity: number;
	unit: string;
	status: string;
	notes: string | null;
}

interface Camp {
	id: string;
	name: string;
}

export default function LogisticsPage() {
	const [items, setItems] = useState<LogisticsItem[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		campId: "",
		itemName: "",
		quantity: "",
		unit: "",
		status: "SUFFICIENT",
		notes: "",
	});

	const loadData = useCallback(() => {
		return fetch("/api/logistics")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setItems(data.data);
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
			const res = await fetch("/api/logistics", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					campId: formData.campId,
					itemName: formData.itemName,
					quantity: Number(formData.quantity),
					unit: formData.unit,
					status: formData.status,
					notes: formData.notes || null,
				}),
			});
			const data = await res.json();
			if (data.success) {
				setShowModal(false);
				setFormData({
					campId: "",
					itemName: "",
					quantity: "",
					unit: "",
					status: "SUFFICIENT",
					notes: "",
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
		if (!confirm("Hapus data ini?")) return;
		try {
			const res = await fetch(`/api/logistics/${id}`, {
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
					Data Logistik
				</h1>
				<Button onClick={() => setShowModal(true)}>
					+ Tambah Data
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
									Nama Barang
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Jumlah
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Status
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
							{items.map((item) => (
								<tr key={item.id} className="hover:bg-gray-50">
									<td className="px-6 py-4 text-sm font-medium text-gray-900">
										{item.itemName}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{item.quantity} {item.unit}
									</td>
									<td className="px-6 py-4">
										<Badge label={item.status} />
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{item.camp?.name}
									</td>
									<td className="px-6 py-4 text-sm">
										<button
											onClick={() =>
												handleDelete(item.id)
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
				title="Tambah Data Logistik"
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
						label="Nama Barang"
						value={formData.itemName}
						onChange={(v) =>
							setFormData({ ...formData, itemName: v })
						}
						placeholder="Nama barang"
						required
					/>
					<FormField
						label="Jumlah"
						type="number"
						value={formData.quantity}
						onChange={(v) =>
							setFormData({ ...formData, quantity: v })
						}
						required
					/>
					<FormField
						label="Unit"
						value={formData.unit}
						onChange={(v) =>
							setFormData({ ...formData, unit: v })
						}
						placeholder="kg, dus, box, dll"
						required
					/>
					<FormSelect
						label="Status"
						value={formData.status}
						onChange={(v) =>
							setFormData({ ...formData, status: v })
						}
						options={[
							{ value: "SUFFICIENT", label: "Cukup" },
							{ value: "LOW", label: "Menipis" },
							{ value: "CRITICAL", label: "Kritis" },
							{ value: "SPOILED_OR_DAMAGED", label: "Rusak" },
						]}
					/>
					<FormField
						label="Catatan"
						value={formData.notes}
						onChange={(v) =>
							setFormData({ ...formData, notes: v })
						}
						placeholder="Catatan (opsional)"
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
