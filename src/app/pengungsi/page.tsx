"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, FormSelect } from "@/components/ui/form-field";
import { SearchInput } from "@/components/ui/search-input";
import { ActionMenu } from "@/components/ui/action-menu";
import { Pagination } from "@/components/ui/pagination";
import { useSession } from "@/components/auth/user-provider";

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

interface PaginatedData {
	data: Evacuee[];
	pagination?: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export default function EvacueesPage() {
	const { user } = useSession();
	const isSuperAdmin = user?.role === "SUPER_ADMIN";

	const [evacuees, setEvacuees] = useState<Evacuee[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [modalError, setModalError] = useState("");
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);
	const [showModal, setShowModal] = useState(false);

	const [confirmAction, setConfirmAction] = useState<{
		title: string;
		message: string;
		confirmLabel?: string;
		variant?: "primary" | "danger";
		onConfirm: () => void | Promise<void>;
	} | null>(null);

	const [formData, setFormData] = useState({
		campId: "",
		name: "",
		totalFamily: "1",
		hasSpecialNeeds: "false",
		notes: "",
	});

	const loadData = useCallback((currentPage = 1, searchQuery = "") => {
		const searchParams = new URLSearchParams({
			page: String(currentPage),
			limit: "20",
		});
		if (searchQuery.trim()) {
			searchParams.set("q", searchQuery.trim());
		}

		return fetch(`/api/evacuees?${searchParams.toString()}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					const resData = data.data as PaginatedData;
					if (resData.pagination) {
						setEvacuees(resData.data);
						setPage(resData.pagination.page);
						setTotalPages(resData.pagination.totalPages);
						setTotal(resData.pagination.total);
					} else if (Array.isArray(data.data)) {
						setEvacuees(data.data);
					}
				} else {
					setError(data.message ?? "Gagal memuat data pengungsi.");
				}
			})
			.catch(() => {
				setError("Terjadi kesalahan saat memuat data pengungsi.");
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => {
			void loadData(1, query);
		}, 300);
		return () => clearTimeout(timer);
	}, [query, loadData]);

	useEffect(() => {
		fetch("/api/public/camps")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setCamps(data.data);
				}
			})
			.catch(() => {});
	}, []);

	const openCreateModal = () => {
		setModalError("");
		setFormData({
			campId: isSuperAdmin ? "" : (user?.campId ?? ""),
			name: "",
			totalFamily: "1",
			hasSpecialNeeds: "false",
			notes: "",
		});
		setShowModal(true);
	};

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		const campIdToUse = isSuperAdmin ? formData.campId : (user?.campId ?? formData.campId);
		if (!campIdToUse) {
			setModalError("Pilih posko terlebih dahulu.");
			return;
		}

		setSubmitting(true);
		setModalError("");

		try {
			const res = await fetch("/api/evacuees", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					campId: campIdToUse,
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
					totalFamily: "1",
					hasSpecialNeeds: "false",
					notes: "",
				});
				void loadData(page, query);
			} else {
				setModalError(data.message ?? "Gagal menambahkan pengungsi.");
			}
		} catch {
			setModalError("Terjadi kesalahan koneksi.");
		} finally {
			setSubmitting(false);
		}
	};

	const executeCheckout = async (id: string) => {
		setSubmitting(true);
		setError("");
		try {
			const res = await fetch(`/api/evacuees/${id}/checkout`, {
				method: "POST",
			});
			const data = await res.json();
			if (data.success) {
				void loadData(page, query);
			} else {
				setError(data.message ?? "Gagal check-out pengungsi.");
			}
		} catch {
			setError("Terjadi kesalahan koneksi.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleCheckout = (evacuee: Evacuee) => {
		setConfirmAction({
			title: "Konfirmasi Check-out",
			message: `Konfirmasi check-out untuk pengungsi "${evacuee.name}" (${evacuee.totalFamily} jiwa)? Posko akan memperbarui kapasitas tersedia.`,
			confirmLabel: "Check-out Sekarang",
			variant: "primary",
			onConfirm: () => executeCheckout(evacuee.id),
		});
	};

	const executeDelete = async (id: string) => {
		setSubmitting(true);
		setError("");
		try {
			const res = await fetch(`/api/evacuees/${id}`, {
				method: "DELETE",
			});
			const data = await res.json();
			if (data.success) {
				void loadData(page, query);
			} else {
				setError(data.message ?? "Gagal menghapus pengungsi.");
			}
		} catch {
			setError("Terjadi kesalahan koneksi.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = (evacuee: Evacuee) => {
		setConfirmAction({
			title: "Hapus Data Pengungsi",
			message: `Apakah Anda yakin ingin menghapus data pengungsi "${evacuee.name}"? Data yang dihapus tidak dapat dipulihkan.`,
			confirmLabel: "Hapus Pengungsi",
			variant: "danger",
			onConfirm: () => executeDelete(evacuee.id),
		});
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">
						Data Pengungsi
					</h1>
					<p className="mt-1 text-sm text-gray-500">
						Kelola pendaftaran, catatan kebutuhan khusus, dan kepulangan pengungsi.
					</p>
				</div>

				<Button onClick={openCreateModal} disabled={submitting}>
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
				<div className="flex h-64 items-center justify-center">
					<span className="text-gray-500">
						Memuat...
					</span>
				</div>
			) : (
				<div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
					<div className="overflow-x-auto" role="region" aria-label="Daftar pengungsi" tabIndex={0}>
						<table className="min-w-[52rem] divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
										Nama
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
										Keluarga
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
										Butuh Khusus
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
										Posko
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
										Tanggal
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
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
											{new Date(ev.arrivedAt).toLocaleDateString("id-ID")}
											{ev.departedAt && (
												<span className="text-rose-500">
													{" "}
													- Check-out{" "}
													{new Date(ev.departedAt).toLocaleDateString("id-ID")}
												</span>
											)}
										</td>

										<td className="px-6 py-4 text-sm">
											<ActionMenu
												label={ev.name}
												disabled={submitting}
												items={[
													{ label: "Detail", href: `/pengungsi/${ev.id}` },
													{ label: "Edit", href: `/pengungsi/${ev.id}/edit` },
													...(!ev.departedAt
														? [{ label: "Check-out", onSelect: () => handleCheckout(ev) }]
														: []),
													{ label: "Hapus", danger: true, onSelect: () => handleDelete(ev) },
												]}
											/>
										</td>
									</tr>
								))}

								{evacuees.length === 0 && (
									<tr>
										<td colSpan={6} className="px-6 py-10 text-center text-gray-500">
											Tidak ada data pengungsi.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					<Pagination
						page={page}
						totalPages={totalPages}
						total={total}
						onPageChange={(newPage) => void loadData(newPage, query)}
						disabled={loading || submitting}
					/>
				</div>
			)}

			<Modal
				isOpen={showModal}
				onClose={() => !submitting && setShowModal(false)}
				title="Tambah Pengungsi"
			>
				<form onSubmit={handleCreate} className="space-y-3">
					{modalError && <Alert type="error">{modalError}</Alert>}

					{isSuperAdmin ? (
						<FormSelect
							label="Posko"
							value={formData.campId}
							onChange={(v) => setFormData({ ...formData, campId: v })}
							options={[
								{ value: "", label: "Pilih Posko" },
								...camps.map((camp) => ({
									value: camp.id,
									label: camp.name,
								})),
							]}
							required
							disabled={submitting}
						/>
					) : (
						<div className="space-y-1.5 mb-4">
							<p className="block text-xs font-bold uppercase tracking-wide text-slate-600">Posko</p>
							<div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700">
								{user?.camp?.name ?? "Posko akun Anda"}
							</div>
						</div>
					)}

					<FormField
						label="Nama Keluarga"
						value={formData.name}
						onChange={(v) => setFormData({ ...formData, name: v })}
						placeholder="Nama kepala keluarga / perwakilan"
						required
						disabled={submitting}
					/>

					<FormField
						label="Jumlah Keluarga (jiwa)"
						type="number"
						value={formData.totalFamily}
						onChange={(v) => setFormData({ ...formData, totalFamily: v })}
						min={1}
						step={1}
						required
						disabled={submitting}
					/>

					<FormSelect
						label="Kebutuhan Khusus"
						value={formData.hasSpecialNeeds}
						onChange={(v) => setFormData({ ...formData, hasSpecialNeeds: v })}
						options={[
							{ value: "false", label: "Tidak" },
							{ value: "true", label: "Ya (Lansia, Balita, Disabilitas, Ibu Hamil)" },
						]}
						disabled={submitting}
					/>

					<FormField
						label="Catatan"
						value={formData.notes}
						onChange={(v) => setFormData({ ...formData, notes: v })}
						placeholder="Kondisi kesehatan atau kebutuhan mendesak"
						disabled={submitting}
					/>

					<div className="mt-4 flex justify-end gap-2">
						<Button
							type="button"
							variant="secondary"
							onClick={() => setShowModal(false)}
							disabled={submitting}
						>
							Batal
						</Button>

						<Button type="submit" disabled={submitting}>
							{submitting ? "Menyimpan..." : "Simpan"}
						</Button>
					</div>
				</form>
			</Modal>

			{confirmAction && (
				<ConfirmDialog
					isOpen={Boolean(confirmAction)}
					title={confirmAction.title}
					message={confirmAction.message}
					confirmLabel={confirmAction.confirmLabel}
					variant={confirmAction.variant}
					busy={submitting}
					onConfirm={async () => {
						const action = confirmAction.onConfirm;
						await action();
						setConfirmAction(null);
					}}
					onClose={() => setConfirmAction(null)}
				/>
			)}
		</div>
	);
}
