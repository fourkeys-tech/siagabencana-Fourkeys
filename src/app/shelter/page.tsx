"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, FormSelect } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { SkeletonCard } from "@/components/ui/skeleton";
import { SufficiencyPanel, type CampSufficiency } from "@/components/shelter/sufficiency-panel";
import { useSession } from "@/components/auth/user-provider";
import {
	FACILITY_CATEGORIES,
	FACILITY_CATEGORY_INFO,
	formatFacilityQuantity,
	type FacilityCategory,
} from "@/lib/shelter-standards";

interface FacilityReport {
	id: string;
	campId: string;
	camp: { name: string };
	category: FacilityCategory;
	facilityName: string;
	quantity: number;
	status: "GOOD" | "DAMAGED" | "REPAIRING";
	description: string;
}

interface Camp {
	id: string;
	name: string;
	status: string;
}

type FacilityAction = "REPORT_DAMAGE" | "START_REPAIR" | "COMPLETE_REPAIR" | "MARK_REPLACEMENT";

const actionLabels: Record<FacilityAction, string> = {
	REPORT_DAMAGE: "Lapor rusak",
	START_REPAIR: "Mulai perbaikan",
	COMPLETE_REPAIR: "Tandai selesai diperbaiki",
	MARK_REPLACEMENT: "Tandai perlu penggantian",
};

const categoryOptions = FACILITY_CATEGORIES.map((category) => ({ value: category, label: FACILITY_CATEGORY_INFO[category].label }));

const emptyForm = { campId: "", category: "", facilityName: "", quantity: "1", status: "GOOD", description: "" };

async function fetchJson<T>(path: string): Promise<T> {
	const response = await fetch(path, { cache: "no-store" });
	const data = await response.json().catch(() => ({}));
	if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal memuat data.");
	return data.data as T;
}

function fetchShelterData() {
	return Promise.all([
		fetchJson<FacilityReport[]>("/api/shelter?limit=100"),
		fetchJson<CampSufficiency[]>("/api/shelter/summary"),
	]);
}

export default function ShelterPage() {
	const { user } = useSession();
	const isSuperAdmin = user?.role === "SUPER_ADMIN";

	const [reports, setReports] = useState<FacilityReport[]>([]);
	const [summary, setSummary] = useState<CampSufficiency[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("");
	const [modalError, setModalError] = useState("");
	const [actionModalError, setActionModalError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [actionReport, setActionReport] = useState<FacilityReport | null>(null);
	const [action, setAction] = useState<FacilityAction | null>(null);
	const [actionNote, setActionNote] = useState("");
	const [damagedQuantity, setDamagedQuantity] = useState("");
	const [busy, setBusy] = useState(false);
	const [formData, setFormData] = useState(emptyForm);
	const [confirmAction, setConfirmAction] = useState<{
		title: string;
		message: string;
		confirmLabel?: string;
		variant?: "primary" | "danger";
		onConfirm: () => void | Promise<void>;
	} | null>(null);

	const loadData = useCallback(async () => {
		try {
			const [list, sufficiency] = await fetchShelterData();
			setReports(list);
			setSummary(sufficiency);
			setError("");
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		fetchShelterData()
			.then(([list, sufficiency]) => {
				if (cancelled) return;
				setReports(list);
				setSummary(sufficiency);
			})
			.catch((loadError: unknown) => {
				if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		if (isSuperAdmin) {
			fetchJson<Camp[]>("/api/camps")
				.then((list) => { if (!cancelled) setCamps(list.filter((camp) => camp.status === "ACTIVE")); })
				.catch(() => undefined);
		}
		return () => { cancelled = true; };
	}, [isSuperAdmin]);

	const visibleReports = categoryFilter ? reports.filter((report) => report.category === categoryFilter) : reports;
	const formCategory = formData.category ? FACILITY_CATEGORY_INFO[formData.category as FacilityCategory] : null;

	const openCreateModal = () => {
		setModalError("");
		setFormData({ ...emptyForm, campId: isSuperAdmin ? "" : (user?.campId ?? "") });
		setShowModal(true);
	};

	const handleCreate = async () => {
		const campIdToUse = isSuperAdmin ? formData.campId : (user?.campId ?? formData.campId);
		if (!campIdToUse) return setModalError("Pilih posko terlebih dahulu.");
		if (!formData.category) return setModalError("Pilih kategori fasilitas.");
		setBusy(true);
		setModalError("");
		try {
			const response = await fetch("/api/shelter", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...formData, campId: campIdToUse }),
			});
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal membuat laporan shelter.");
			setShowModal(false);
			setFormData(emptyForm);
			setNotice("");
			await loadData();
		} catch (createError) {
			setModalError(createError instanceof Error ? createError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	const executeDelete = async (report: FacilityReport) => {
		setBusy(true);
		setError("");
		try {
			const response = await fetch(`/api/shelter/${report.id}`, { method: "DELETE" });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal menghapus laporan.");
			setNotice("");
			await loadData();
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	const handleDelete = (report: FacilityReport) => {
		setConfirmAction({
			title: "Hapus Laporan Fasilitas",
			message: `Hapus laporan fasilitas "${report.facilityName}"? Penghapusan tidak boleh digunakan untuk menyelesaikan kerusakan yang masih ditangani.`,
			confirmLabel: "Hapus Laporan",
			variant: "danger",
			onConfirm: () => executeDelete(report),
		});
	};

	const handleAction = async () => {
		if (!actionReport || !action || !actionNote.trim()) {
			setActionModalError("Catatan tindakan wajib diisi agar keputusan fasilitas dapat diaudit.");
			return;
		}
		setBusy(true);
		setActionModalError("");
		try {
			const response = await fetch(`/api/shelter/${actionReport.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action,
					note: actionNote,
					...(action === "REPORT_DAMAGE" && damagedQuantity.trim() ? { damagedQuantity: damagedQuantity.trim() } : {}),
				}),
			});
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal memperbarui status fasilitas.");
			setActionReport(null);
			setAction(null);
			setActionNote("");
			setDamagedQuantity("");
			setNotice(data.message ?? "");
			await loadData();
		} catch (actionError) {
			setActionModalError(actionError instanceof Error ? actionError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	const openAction = (report: FacilityReport, nextAction: FacilityAction) => {
		setActionReport(report);
		setAction(nextAction);
		setActionNote("");
		setDamagedQuantity("");
		setActionModalError("");
	};

	const actionInfo = actionReport ? FACILITY_CATEGORY_INFO[actionReport.category] : null;

	return (
		<div className="space-y-6">
			<div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Fasilitas Shelter</h1>
					<p className="mt-1 text-sm text-slate-500">Catat fasilitas posko per kategori, pantau kecukupannya terhadap jumlah pengungsi, dan tangani kerusakan.</p>
				</div>
				<Button onClick={openCreateModal}>+ Tambah Fasilitas</Button>
			</div>
			{error && <Alert type="error">{error}</Alert>}
			{notice && <Alert type="success">{notice}</Alert>}

			{loading ? (
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
				</div>
			) : (
				<>
					<SufficiencyPanel camps={summary} />

					<div className="space-y-3">
						<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
							<h2 className="text-lg font-bold text-slate-900">Daftar fasilitas</h2>
							<div className="w-full sm:w-64 [&>div]:mb-0">
								<FormSelect
									label="Filter kategori"
									value={categoryFilter}
									onChange={setCategoryFilter}
									options={[{ value: "", label: "Semua kategori" }, ...categoryOptions]}
								/>
							</div>
						</div>
						<div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
							<div className="overflow-x-auto" role="region" aria-label="Daftar fasilitas shelter" tabIndex={0}>
								<table className="w-full min-w-[64rem] divide-y divide-slate-200">
									<thead className="bg-slate-50">
										<tr>
											{["Fasilitas", "Kategori", "Jumlah", "Status", "Keterangan", "Posko", "Aksi"].map((header) => (
												<th key={header} scope="col" className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">
													{header}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-200">
										{visibleReports.map((report) => {
											const info = FACILITY_CATEGORY_INFO[report.category];
											const items: ActionMenuItem[] = [
												{ label: "Detail", href: `/shelter/${report.id}` },
												{ label: "Edit", href: `/shelter/${report.id}/edit` },
											];
											if (report.status === "GOOD") items.push({ label: actionLabels.REPORT_DAMAGE, onSelect: () => openAction(report, "REPORT_DAMAGE") });
											if (report.status === "DAMAGED") items.push({ label: actionLabels.START_REPAIR, onSelect: () => openAction(report, "START_REPAIR") });
											if (report.status === "REPAIRING") items.push({ label: actionLabels.COMPLETE_REPAIR, onSelect: () => openAction(report, "COMPLETE_REPAIR") });
											if (report.status !== "GOOD") items.push({ label: actionLabels.MARK_REPLACEMENT, onSelect: () => openAction(report, "MARK_REPLACEMENT") });
											items.push({ label: "Hapus", danger: true, onSelect: () => handleDelete(report) });
											return (
												<tr key={report.id} className="hover:bg-slate-50">
													<td className="px-5 py-4 text-sm font-medium text-slate-900">{report.facilityName}</td>
													<td className="px-5 py-4 text-sm text-slate-700">{info.label}</td>
													<td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">{formatFacilityQuantity(report.quantity, info.unit)}</td>
													<td className="px-5 py-4"><Badge label={report.status} /></td>
													<td className="max-w-xs truncate px-5 py-4 text-sm text-slate-600">{report.description}</td>
													<td className="px-5 py-4 text-sm text-slate-900">{report.camp?.name}</td>
													<td className="px-5 py-4 text-sm"><ActionMenu label={report.facilityName} items={items} disabled={busy} /></td>
												</tr>
											);
										})}
										{visibleReports.length === 0 && (
											<tr>
												<td colSpan={7} className="px-6 py-10 text-center text-slate-500">
													{categoryFilter ? "Tidak ada fasilitas pada kategori ini." : "Belum ada fasilitas tercatat."}
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</>
			)}

			<Modal isOpen={showModal} onClose={() => !busy && setShowModal(false)} title="Tambah Fasilitas">
				<form onSubmit={(event) => { event.preventDefault(); void handleCreate(); }} className="space-y-3">
					{modalError && <Alert type="error">{modalError}</Alert>}
					{isSuperAdmin ? (
						<FormSelect
							label="Posko"
							value={formData.campId}
							onChange={(value) => setFormData({ ...formData, campId: value })}
							options={[{ value: "", label: "Pilih Posko" }, ...camps.map((camp) => ({ value: camp.id, label: camp.name }))]}
							required
							disabled={busy}
						/>
					) : (
						<div className="mb-4 space-y-1.5">
							<p className="block text-xs font-bold uppercase tracking-wide text-slate-600">Posko</p>
							<div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700">
								{user?.camp?.name ?? "Posko akun Anda"}
							</div>
						</div>
					)}
					<FormSelect
						label="Kategori"
						value={formData.category}
						onChange={(value) => setFormData({ ...formData, category: value })}
						options={[{ value: "", label: "Pilih kategori" }, ...categoryOptions]}
						required
						disabled={busy}
					/>
					{formCategory && (
						<p className="-mt-2 mb-3 text-xs text-slate-500">Standar: {formCategory.standardLabel}.</p>
					)}
					<FormField
						label="Nama Fasilitas"
						value={formData.facilityName}
						onChange={(value) => setFormData({ ...formData, facilityName: value })}
						placeholder={formCategory ? `Contoh: ${formCategory.example}` : "Nama fasilitas"}
						required
						disabled={busy}
					/>
					<FormField
						label={formCategory?.quantityLabel ?? "Jumlah unit"}
						type="number"
						min={1}
						step={1}
						value={formData.quantity}
						onChange={(value) => setFormData({ ...formData, quantity: value })}
						required
						disabled={busy}
					/>
					<FormSelect
						label="Status awal"
						value={formData.status}
						onChange={(value) => setFormData({ ...formData, status: value })}
						options={[
							{ value: "GOOD", label: "Baik" },
							{ value: "DAMAGED", label: "Rusak" },
						]}
						disabled={busy}
					/>
					<FormField
						label="Deskripsi"
						value={formData.description}
						onChange={(value) => setFormData({ ...formData, description: value })}
						placeholder="Lokasi, kondisi, atau sumber fasilitas"
						required
						disabled={busy}
					/>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={busy}>
							Batal
						</Button>
						<Button type="submit" disabled={busy}>
							{busy ? "Menyimpan..." : "Simpan"}
						</Button>
					</div>
				</form>
			</Modal>

			<Modal isOpen={Boolean(actionReport && action)} onClose={() => !busy && setActionReport(null)} title={action ? actionLabels[action] : "Tindakan fasilitas"}>
				{actionReport && action && actionInfo && (
					<form onSubmit={(event) => { event.preventDefault(); void handleAction(); }} className="space-y-3">
						{actionModalError && <Alert type="error">{actionModalError}</Alert>}
						<p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
							<b>{actionReport.facilityName}</b> ({formatFacilityQuantity(actionReport.quantity, actionInfo.unit)})<br />
							{action === "REPORT_DAMAGE"
								? "Isi jumlah rusak bila hanya sebagian. Unit rusak dipisah ke laporan baru, sisanya tetap Baik."
								: action === "MARK_REPLACEMENT"
									? "Laporan tetap rusak dan keputusan penggantian dicatat."
									: "Catatan ini menjadi bukti tindakan fasilitas."}
						</p>
						{action === "REPORT_DAMAGE" && actionReport.quantity > 1 && (
							<FormField
								label={`Jumlah rusak (${actionInfo.unit})`}
								type="number"
								min={1}
								max={actionReport.quantity}
								step={1}
								value={damagedQuantity}
								onChange={setDamagedQuantity}
								placeholder={`Kosongkan bila seluruh ${actionReport.quantity.toLocaleString("id-ID")} rusak`}
								disabled={busy}
							/>
						)}
						<FormField
							label="Catatan tindakan"
							value={actionNote}
							onChange={setActionNote}
							placeholder={
								action === "REPORT_DAMAGE"
									? "Kerusakan yang ditemukan"
									: action === "MARK_REPLACEMENT"
										? "Alasan dan rencana pengadaan pengganti"
										: "Petugas, pekerjaan, atau hasil pemeriksaan"
							}
							required
							disabled={busy}
						/>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="secondary" onClick={() => setActionReport(null)} disabled={busy}>
								Batal
							</Button>
							<Button type="submit" disabled={busy}>
								{busy ? "Menyimpan..." : "Simpan tindakan"}
							</Button>
						</div>
					</form>
				)}
			</Modal>

			{confirmAction && (
				<ConfirmDialog
					isOpen={Boolean(confirmAction)}
					title={confirmAction.title}
					message={confirmAction.message}
					confirmLabel={confirmAction.confirmLabel}
					variant={confirmAction.variant}
					busy={busy}
					onConfirm={async () => {
						const act = confirmAction.onConfirm;
						await act();
						setConfirmAction(null);
					}}
					onClose={() => setConfirmAction(null)}
				/>
			)}
		</div>
	);
}
