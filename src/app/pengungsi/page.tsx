"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FormField, FormSelect } from "@/components/ui/form-field";
import { SearchInput, filterByQuery } from "@/components/ui/search-input";
import { ActionMenu } from "@/components/ui/action-menu";

interface Evacuee {
	id: string;
	name: string;
	totalFamily: number;
	hasSpecialNeeds: boolean;
	notes: string | null;
	arrivedAt: string;
	departedAt: string | null;
	camp: {
		name: string;
	};
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
	const [query, setQuery] = useState("");
	const [showModal, setShowModal] = useState(false);

	const [formData, setFormData] = useState({
		campId: "",
		name: "",
		totalFamily: "",
		hasSpecialNeeds: "false",
		notes: "",
	});

	const loadData = useCallback(() => {
		return fetch("/api/evacuees?limit=100")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setEvacuees(data.data.data ?? data.data);
				} else {
					setError(data.message ?? "Gagal memuat data");
				}
			})
			.catch(() => {
				setError("Terjadi kesalahan");
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	useEffect(() => {
		loadData();

		fetch("/api/public/camps")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setCamps(data.data);
				}
			})
			.catch(() => { });
	}, [loadData]);

	const handleCreate = async () => {
		try {
			const res = await fetch("/api/evacuees", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					campId: formData.campId,
					name: formData.name,
					totalFamily: Number(formData.totalFamily),
					hasSpecialNeeds:
						formData.hasSpecialNeeds === "true",
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
		if (!confirm("Konfirmasi check-out pengungsi ini?")) {
			return;
		}

		try {
			const res = await fetch(`/api/evacuees/${id}/checkout`, {
				method: "POST",
			});

			const data = await res.json();

			if (data.success) {
				loadData();
			} else {
				setError(data.message);
			}
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus data pengungsi ini?")) {
			return;
		}

		try {
			const res = await fetch(`/api/evacuees/${id}`, {
				method: "DELETE",
			});

			const data = await res.json();

			if (data.success) {
				loadData();
			} else {
				setError(data.message);
			}
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	const visibleEvacuees = filterByQuery<
		Evacuee & { campName: string }
	>(
		evacuees.map((ev) => ({
			...ev,
			campName: ev.camp?.name ?? "",
		})),
		query,
		["name", "notes", "campName"],
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">
						Data Pengungsi
					</h1>
				</div>

				<Button onClick={() => setShowModal(true)}>
					+ Tambah Pengungsi
				</Button>
			</div>

			{error && (
				<Alert type="error">
					{error}
				</Alert>
			)}

			<div className="max-w-md">
				<SearchInput
					value={query}
					onChange={setQuery}
					placeholder="Cari nama, catatan, atau posko..."
				/>
			</div>

			{loading ? (
				<div className="flex items-center justify-center h-64">
					<span className="text-gray-500">
						Memuat...
					</span>
				</div>
			) : (
				<div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
					<div className="overflow-x-auto" role="region" aria-label="Daftar pengungsi" tabIndex={0}><table className="min-w-[52rem] divide-y divide-gray-200">
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
							{visibleEvacuees.map((ev) => (
								<tr
									key={ev.id}
									className="hover:bg-gray-50"
								>
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
												).toLocaleDateString(
													"id-ID",
												)}
											</span>
										)}
									</td>

									<td className="px-6 py-4 text-sm">
										{!ev.departedAt && (
											<button
												onClick={() =>
													handleCheckout(ev.id)
												}
												className="hidden"
											>
												Check-out
											</button>
										)}

										<button
											onClick={() =>
												handleDelete(ev.id)
											}
											className="hidden"
										>
											Hapus
										</button>
										<ActionMenu label={ev.name} items={[{ label: "Detail", href: `/pengungsi/${ev.id}` }, { label: "Edit", href: `/pengungsi/${ev.id}/edit` }, ...(!ev.departedAt ? [{ label: "Check-out", onSelect: () => void handleCheckout(ev.id) }] : []), { label: "Hapus", danger: true, onSelect: () => void handleDelete(ev.id) }]} />
									</td>
								</tr>
							))}

							{visibleEvacuees.length === 0 && (
								<tr>
									<td
										colSpan={6}
										className="px-6 py-10 text-center text-gray-500"
									>
										Tidak ada data pengungsi.
									</td>
								</tr>
							)}
						</tbody>
					</table></div>
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
							setFormData({
								...formData,
								campId: v,
							})
						}
						options={[
							{
								value: "",
								label: "Pilih Posko",
							},
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
							setFormData({
								...formData,
								name: v,
							})
						}
						placeholder="Nama keluarga"
						required
					/>

					<FormField
						label="Jumlah Keluarga"
						type="number"
						value={formData.totalFamily}
						onChange={(v) =>
							setFormData({
								...formData,
								totalFamily: v,
							})
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
							{
								value: "false",
								label: "Tidak",
							},
							{
								value: "true",
								label: "Ya",
							},
						]}
					/>

					<FormField
						label="Catatan"
						value={formData.notes}
						onChange={(v) =>
							setFormData({
								...formData,
								notes: v,
							})
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

						<Button type="submit">
							Simpan
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}