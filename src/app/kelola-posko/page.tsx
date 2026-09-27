"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import type { CampLocation } from "@/components/camps/camp-location-picker";

const CampLocationPicker = dynamic(
	() => import("@/components/camps/camp-location-picker").then((module) => module.CampLocationPicker),
	{ ssr: false, loading: () => <div className="flex h-72 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">Memuat peta...</div> },
);

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

const initialForm = { name: "", address: "", maxCapacity: "" };

function locationLabel(location: CampLocation | null) {
	if (!location) return "Belum dipilih";
	return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

export default function CampsPage() {
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [busy, setBusy] = useState(false);
	const [formData, setFormData] = useState(initialForm);
	const [location, setLocation] = useState<CampLocation | null>(null);

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/camps", { cache: "no-store" });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal memuat data posko.");
			setCamps(data.data);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadData();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [loadData]);

	const resetForm = () => {
		setFormData(initialForm);
		setLocation(null);
	};

	const handleCreate = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!location) {
			setError("Klik peta untuk menentukan lokasi posko terlebih dahulu.");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/camps", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...formData, ...location, maxCapacity: Number(formData.maxCapacity) }),
			});
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal membuat posko.");
			setShowModal(false);
			resetForm();
			await loadData();
		} catch (createError) {
			setError(createError instanceof Error ? createError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	const handleDelete = async (id: string, name: string) => {
		if (!confirm(`Hapus posko "${name}"?`)) return;
		setBusy(true);
		setError("");
		try {
			const response = await fetch(`/api/camps/${id}`, { method: "DELETE" });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal menghapus posko.");
			await loadData();
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	const handleStatusToggle = async (camp: Camp) => {
		setBusy(true);
		setError("");
		try {
			const response = await fetch(`/api/camps/${camp.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: camp.status === "ACTIVE" ? "CLOSED" : "ACTIVE" }) });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal mengubah status posko.");
			await loadData();
		} catch (statusError) {
			setError(statusError instanceof Error ? statusError.message : "Terjadi kesalahan.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">Manajemen lokasi</p><h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Kelola Posko</h1><p className="mt-2 text-sm text-slate-500">Tambah lokasi dengan memilih titik langsung pada peta agar alamat posko lebih akurat.</p></div><Button onClick={() => { resetForm(); setError(""); setShowModal(true); }}>+ Tambah Posko</Button></div>
			{error && <Alert type="error">{error}</Alert>}
			{loading ? <div className="flex h-64 items-center justify-center text-sm text-slate-500">Memuat posko...</div> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Nama", "Alamat", "Kapasitas", "Status", "Aksi"].map((label) => <th key={label} className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{camps.map((camp) => <tr key={camp.id} className="hover:bg-slate-50"><td className="px-5 py-4"><Link href={`/kelola-posko/${camp.id}`} className="text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline">{camp.name}</Link></td><td className="max-w-xs px-5 py-4 text-sm text-slate-600">{camp.address}</td><td className="px-5 py-4 text-sm text-slate-600">{camp.currentOccupants}/{camp.maxCapacity}</td><td className="px-5 py-4"><Badge label={camp.status} /></td><td className="px-5 py-4"><div className="flex flex-wrap gap-2"><Link href={`/kelola-posko/${camp.id}`}><Button variant="ghost" className="px-3 py-1.5">Detail</Button></Link><Link href={`/kelola-posko/${camp.id}/edit`}><Button variant="secondary" className="px-3 py-1.5">Edit</Button></Link><Button variant="ghost" className="px-3 py-1.5" disabled={busy} onClick={() => void handleStatusToggle(camp)}>{camp.status === "ACTIVE" ? "Tutup" : "Buka"}</Button><Button variant="danger" className="px-3 py-1.5" disabled={busy} onClick={() => void handleDelete(camp.id, camp.name)}>Hapus</Button></div></td></tr>)}{camps.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">Belum ada posko.</td></tr>}</tbody></table></div></div>}
			<Modal isOpen={showModal} onClose={() => !busy && setShowModal(false)} title="Tambah Posko"><form onSubmit={handleCreate} className="space-y-3"><FormField label="Nama Posko" value={formData.name} onChange={(value) => setFormData({ ...formData, name: value })} placeholder="Contoh: Posko Balai Desa Candi" required /><FormField label="Alamat" value={formData.address} onChange={(value) => setFormData({ ...formData, address: value })} placeholder="Jalan, desa, kecamatan, kabupaten" required /><FormField label="Kapasitas Maksimal" type="number" value={formData.maxCapacity} onChange={(value) => setFormData({ ...formData, maxCapacity: value })} placeholder="200" required /><div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="mb-3"><p className="text-sm font-bold text-slate-800">Tentukan titik lokasi</p><p className="mt-1 text-xs leading-5 text-slate-500">Klik lokasi posko pada peta atau geser pin ke titik yang tepat.</p></div><CampLocationPicker value={location} onChange={setLocation} /><p className="mt-3 text-xs font-semibold text-slate-600">Titik terpilih: {locationLabel(location)}</p></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={busy}>Batal</Button><Button type="submit" disabled={busy || !location}>{busy ? "Menyimpan..." : "Simpan Posko"}</Button></div></form></Modal>
		</div>
	);
}
