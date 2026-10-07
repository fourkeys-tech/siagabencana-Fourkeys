"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSelect } from "@/components/ui/form-field";
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

function locationLabel(location: CampLocation | null) {
	if (!location) return "Belum dipilih";
	return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

export default function CampEditPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;
	const [camp, setCamp] = useState<Camp | null>(null);
	const [formData, setFormData] = useState({ name: "", address: "", maxCapacity: "", status: "" });
	const [location, setLocation] = useState<CampLocation | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!id) return;
		fetch(`/api/camps/${id}`)
			.then(async (response) => {
				const data = await response.json();
				if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal memuat data posko.");
				setCamp(data.data);
				setFormData({ name: data.data.name, address: data.data.address, maxCapacity: String(data.data.maxCapacity), status: data.data.status });
				setLocation({ latitude: data.data.latitude, longitude: data.data.longitude });
			})
			.catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan."))
			.finally(() => setLoading(false));
	}, [id]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!location) {
			setError("Pilih lokasi posko pada peta.");
			return;
		}
		setSubmitting(true);
		setError("");
		try {
			const response = await fetch(`/api/camps/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, ...location, maxCapacity: Number(formData.maxCapacity) }) });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal memperbarui posko.");
			router.push(`/kelola-posko/${id}`);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Terjadi kesalahan.");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) return <div className="flex h-64 items-center justify-center text-sm text-slate-500">Memuat posko...</div>;
	if (error && !camp) return <div className="space-y-4"><Alert type="error">{error}</Alert><Link href="/kelola-posko"><Button variant="secondary">Kembali ke Posko</Button></Link></div>;
	if (!camp) return <div className="space-y-4"><Alert type="info">Posko tidak ditemukan.</Alert><Link href="/kelola-posko"><Button variant="secondary">Kembali ke Posko</Button></Link></div>;

	return <div className="w-full max-w-3xl min-w-0 space-y-6"><div><Link href={`/kelola-posko/${camp.id}`} className="text-sm font-medium text-blue-600 hover:underline">← Kembali ke Detail Posko</Link><h1 className="mt-2 text-2xl font-bold text-slate-950">Edit Posko: {camp.name}</h1><p className="mt-2 text-sm text-slate-500">Geser pin atau klik titik baru pada peta untuk memperbarui lokasi.</p></div>{error && <Alert type="error">{error}</Alert>}<form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><FormField label="Nama Posko" value={formData.name} onChange={(value) => setFormData({ ...formData, name: value })} required /><FormField label="Alamat" value={formData.address} onChange={(value) => setFormData({ ...formData, address: value })} required /><FormField label="Kapasitas Maksimal" type="number" value={formData.maxCapacity} onChange={(value) => setFormData({ ...formData, maxCapacity: value })} required /><FormSelect label="Status" value={formData.status} onChange={(value) => setFormData({ ...formData, status: value })} options={[{ value: "ACTIVE", label: "Aktif" }, { value: "CLOSED", label: "Ditutup" }]} required /><div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="mb-3"><p className="text-sm font-bold text-slate-800">Lokasi pada peta</p><p className="mt-1 text-xs leading-5 text-slate-500">Klik peta atau geser pin untuk memilih titik lokasi yang benar.</p></div><CampLocationPicker value={location} onChange={setLocation} /><p className="mt-3 text-xs font-semibold text-slate-600">Titik terpilih: {locationLabel(location)}</p></div><div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end sm:gap-3"><Link href={`/kelola-posko/${camp.id}`}><Button type="button" variant="secondary">Batal</Button></Link><Button type="submit" disabled={submitting || !location}>{submitting ? "Menyimpan..." : "Simpan Perubahan"}</Button></div></form></div>;
}
