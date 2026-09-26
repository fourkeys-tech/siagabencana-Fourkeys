"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface Evacuee {
	id: string;
	name: string;
	totalFamily: number;
	hasSpecialNeeds: boolean;
	notes: string | null;
	arrivedAt: string;
	departedAt: string | null;
	camp: { name: string };
}

interface Camp {
	id: string;
	name: string;
}

export default function EvacueesPage() {
	const [evacuees, setEvacuees] = useState<Evacuee[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState({
		campId: "",
		name: "",
		totalFamily: "",
		hasSpecialNeeds: "false",
		notes: "",
	});

	const loadData = useCallback(() => {
		return fetch("/api/evacuees")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setEvacuees(data.data);
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
			const res = await fetch("/api/evacuees", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					campId: formData.campId,
					name: formData.name,
					totalFamily: Number(formData.totalFamily),
					hasSpecialNeeds: formData.hasSpecialNeeds === "true",
					notes: formData.notes || null,
				}),
			});
			const data = await res.json();
			if (data.success) {
				setShowModal(false);
				setFormData({
					campId: "",
					name: "",
					totalFamily: "",
					hasSpecialNeeds: "false",
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

	const handleCheckout = async (id: string) => {
		if (!confirm("Konfirmasi check-out pengungsi ini?")) return;
		try {
			const res = await fetch(`/api/evacuees/${id}/checkout`, {
				method: "POST",
			});
			const data = await res.json();
			if (data.success) loadData();
			else setError(data.message);
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus data pengungsi ini?")) return;
		try {
			const res = await fetch(`/api/evacuees/${id}`, {
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
					Data Pengungsi
				</h1>
				<Button onClick={() => setShowModal(true)}>
					+ Tambah Pengungsi
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
									Nama
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Keluarga
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Butuh Khusus
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Posko
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Tanggal
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Aksi
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{evacuees.map((ev) => (
								<tr key={ev.id} className="hover:bg-gray-50">
									<td className="px-6 py-4 text-sm font-medium text-gray-900">
										{ev.name}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{ev.totalFamily} orang
									</td>
									<td className="px-6 py-4">
										{ev.hasSpecialNeeds ? (
											<Badge label="YA" />
										) : (
											<span className="text-gray-400">
												Tidak
											</span>
										)}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{ev.camp?.name}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900">
										{new Date(
											ev.arrivedAt,
										).toLocaleDateString("id-ID")}
										{ev.departedAt && (
											<span className="text-red-500">
												{" "}
												- Check-out{" "}
												{new Date(
													ev.departedAt,
												).toLocaleDateString("id-ID")}
											</span>
										)}
									</td>
									<td className="px-6 py-4 text-sm space-x-2">
										{!ev.departedAt && (
											<button
												onClick={() =>
													handleCheckout(ev.id)
												}
												className="text-green-600 hover:underline"
											>
												Check-out
											</button>
										)}
										<button
											onClick={() =>
												handleDelete(ev.id)
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
				title="Tambah Pengungsi"
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
						label="Nama Keluarga"
						value={formData.name}
						onChange={(v) =>
							setFormData({ ...formData, name: v })
						}
						placeholder="Nama keluarga"
						required
					/>
					<FormField
						label="Jumlah Keluarga"
						type="number"
						value={formData.totalFamily}
						onChange={(v) =>
							setFormData({ ...formData, totalFamily: v })
						}
						required
					/>
					<FormSelect
						label="Butuh Khusus"
						value={formData.hasSpecialNeeds}
						onChange={(v) =>
							setFormData({
								...formData,
								hasSpecialNeeds: v,
							})
						}
						options={[
							{ value: "false", label: "Tidak" },
							{ value: "true", label: "Ya" },
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
