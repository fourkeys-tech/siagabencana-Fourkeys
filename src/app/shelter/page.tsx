"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField, FormSelect } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";

interface FacilityReport {
	id: string;
	campId: string;
	camp: { name: string };
	facilityName: string;
	status: "GOOD" | "DAMAGED" | "REPAIRING";
	description: string;
}

interface Camp {
	id: string;
	name: string;
}

type FacilityAction = "START_REPAIR" | "COMPLETE_REPAIR" | "MARK_REPLACEMENT";

const actionLabels: Record<FacilityAction, string> = {
	START_REPAIR: "Mulai perbaikan",
	COMPLETE_REPAIR: "Tandai selesai diperbaiki",
	MARK_REPLACEMENT: "Tandai perlu penggantian",
};

export default function ShelterPage() {
	const [reports, setReports] = useState<FacilityReport[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [actionReport, setActionReport] = useState<FacilityReport | null>(null);
	const [action, setAction] = useState<FacilityAction | null>(null);
	const [actionNote, setActionNote] = useState("");
	const [busy, setBusy] = useState(false);
	const [formData, setFormData] = useState({ campId: "", facilityName: "", status: "GOOD", description: "" });

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/shelter", { cache: "no-store" });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal memuat data shelter.");
			setReports(data.data);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => void loadData(), 0);
		fetch("/api/public/camps", { cache: "no-store" }).then((res) => res.json()).then((data) => { if (data.success) setCamps(data.data); }).catch(() => undefined);
		return () => window.clearTimeout(timer);
	}, [loadData]);

	const handleCreate = async () => {
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/shelter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal membuat laporan shelter.");
			setShowModal(false);
			setFormData({ campId: "", facilityName: "", status: "GOOD", description: "" });
			await loadData();
		} catch (createError) {
			setError(createError instanceof Error ? createError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus laporan ini? Penghapusan tidak boleh digunakan untuk menyelesaikan kerusakan yang masih ditangani.")) return;
		setBusy(true);
		setError("");
		try {
			const response = await fetch(`/api/shelter/${id}`, { method: "DELETE" });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal menghapus laporan.");
			await loadData();
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	const handleAction = async () => {
		if (!actionReport || !action || !actionNote.trim()) {
			setError("Catatan tindakan wajib diisi agar keputusan fasilitas dapat diaudit.");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const response = await fetch(`/api/shelter/${actionReport.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: actionNote }) });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal memperbarui status fasilitas.");
			setActionReport(null);
			setAction(null);
			setActionNote("");
			await loadData();
		} catch (actionError) {
			setError(actionError instanceof Error ? actionError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	const openAction = (report: FacilityReport, nextAction: FacilityAction) => {
		setActionReport(report);
		setAction(nextAction);
		setActionNote("");
		setError("");
	};

	return (
		<div className="space-y-6">
			<div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Laporan Shelter</h1><p className="mt-1 text-sm text-slate-500">Pantau triase, perbaikan, dan kebutuhan penggantian fasilitas.</p></div><Button onClick={() => { setError(""); setShowModal(true); }}>+ Tambah Laporan</Button></div>
			{error && <Alert type="error">{error}</Alert>}
			{loading ? <div className="flex h-64 items-center justify-center text-gray-500">Memuat...</div> : <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto" role="region" aria-label="Daftar laporan shelter" tabIndex={0}><table className="min-w-[58rem] divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{["Fasilitas", "Status", "Deskripsi", "Posko", "Aksi"].map((header) => <th key={header} className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-200">{reports.map((report) => { const items: ActionMenuItem[] = [{ label: "Detail", href: `/shelter/${report.id}` }, { label: "Edit", href: `/shelter/${report.id}/edit` }]; if (report.status === "DAMAGED") items.push({ label: actionLabels.START_REPAIR, onSelect: () => openAction(report, "START_REPAIR") }); if (report.status === "REPAIRING") items.push({ label: actionLabels.COMPLETE_REPAIR, onSelect: () => openAction(report, "COMPLETE_REPAIR") }); if (report.status !== "GOOD") items.push({ label: actionLabels.MARK_REPLACEMENT, onSelect: () => openAction(report, "MARK_REPLACEMENT") }); items.push({ label: "Hapus", danger: true, onSelect: () => void handleDelete(report.id) }); return <tr key={report.id} className="hover:bg-gray-50"><td className="px-6 py-4 text-sm font-medium text-gray-900">{report.facilityName}</td><td className="px-6 py-4"><Badge label={report.status} /></td><td className="max-w-xs truncate px-6 py-4 text-sm text-gray-600">{report.description}</td><td className="px-6 py-4 text-sm text-gray-900">{report.camp?.name}</td><td className="px-6 py-4 text-sm"><ActionMenu label={report.facilityName} items={items} disabled={busy} /></td></tr>; })}{reports.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Belum ada laporan fasilitas.</td></tr>}</tbody></table></div></div>}

			<Modal isOpen={showModal} onClose={() => !busy && setShowModal(false)} title="Tambah Laporan Shelter"><form onSubmit={(event) => { event.preventDefault(); void handleCreate(); }} className="space-y-3"><FormSelect label="Posko" value={formData.campId} onChange={(value) => setFormData({ ...formData, campId: value })} options={[{ value: "", label: "Pilih Posko" }, ...camps.map((camp) => ({ value: camp.id, label: camp.name }))]} required /><FormField label="Nama Fasilitas" value={formData.facilityName} onChange={(value) => setFormData({ ...formData, facilityName: value })} placeholder="Nama fasilitas" required /><FormSelect label="Status awal" value={formData.status} onChange={(value) => setFormData({ ...formData, status: value })} options={[{ value: "GOOD", label: "Baik" }, { value: "DAMAGED", label: "Rusak" }, { value: "REPAIRING", label: "Dalam Perbaikan" }]} /><FormField label="Deskripsi" value={formData.description} onChange={(value) => setFormData({ ...formData, description: value })} placeholder="Deskripsi kondisi fasilitas" required /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={busy}>Batal</Button><Button type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button></div></form></Modal>
			<Modal isOpen={Boolean(actionReport && action)} onClose={() => !busy && setActionReport(null)} title={action ? actionLabels[action] : "Tindakan fasilitas"}>{actionReport && action && <form onSubmit={(event) => { event.preventDefault(); void handleAction(); }} className="space-y-3"><p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><b>{actionReport.facilityName}</b><br />Status saat ini: {actionReport.status}. {action === "MARK_REPLACEMENT" ? "Laporan tetap rusak dan keputusan penggantian dicatat." : "Catatan ini menjadi bukti tindakan fasilitas."}</p><FormField label="Catatan tindakan" value={actionNote} onChange={setActionNote} placeholder={action === "MARK_REPLACEMENT" ? "Alasan dan rencana pengadaan pengganti" : "Petugas, pekerjaan, atau hasil pemeriksaan"} required /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setActionReport(null)} disabled={busy}>Batal</Button><Button type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan tindakan"}</Button></div></form>}</Modal>
		</div>
	);
}
