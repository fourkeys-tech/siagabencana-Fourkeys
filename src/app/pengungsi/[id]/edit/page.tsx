"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface Evacuee {
	id: string;
	campId: string;
	name: string;
	totalFamily: number;
	hasSpecialNeeds: boolean;
	notes: string | null;
	arrivedAt: string;
	departedAt: string | null;
}

export default function EvacueeEditPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [evacuee, setEvacuee] = useState<Evacuee | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		totalFamily: "",
		hasSpecialNeeds: "false",
		notes: "",
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!id) return;

		fetch(`/api/evacuees/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setEvacuee(data.data);
					setFormData({
						name: data.data.name,
						totalFamily: String(data.data.totalFamily),
						hasSpecialNeeds: String(data.data.hasSpecialNeeds),
						notes: data.data.notes ?? "",
					});
				} else {
					setError(data.message ?? "Gagal memuat data pengungsi.");
				}
			})
			.catch(() => setError("Terjadi kesalahan koneksi."))
			.finally(() => setLoading(false));
	}, [id]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setError("");

		try {
			const res = await fetch(`/api/evacuees/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					hasSpecialNeeds: formData.hasSpecialNeeds === "true",
					notes: formData.notes || null,
				}),
			});

			const data = await res.json();

			if (data.success) {
				router.push(`/pengungsi/${id}`);
				router.refresh();
			} else {
				setError(data.message ?? "Gagal memperbarui data pengungsi.");
			}
		} catch {
			setError("Terjadi kesalahan saat menyimpan perubahan.");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<span className="text-lg text-gray-500">Memuat...</span>
			</div>
		);
	}

	if (error && !evacuee) {
		return (
			<div className="space-y-4">
				<Alert type="error">{error}</Alert>
				<Link href="/pengungsi"><Button variant="secondary">Kembali ke Daftar Pengungsi</Button></Link>
			</div>
		);
	}

	if (!evacuee) {
		return (
			<div className="space-y-4">
				<Alert type="info">Data pengungsi tidak ditemukan.</Alert>
				<Link href="/pengungsi"><Button variant="secondary">Kembali ke Daftar Pengungsi</Button></Link>
			</div>
		);
	}

	return (
		<div className="w-full max-w-3xl min-w-0 space-y-6">
			<div>
				<Link href={`/pengungsi/${evacuee.id}`} className="text-sm font-medium text-blue-600 hover:underline">
					← Kembali ke Detail Pengungsi
				</Link>
				<h1 className="mt-1 text-2xl font-bold text-gray-900">
					Edit Pengungsi: {evacuee.name}
				</h1>
			</div>

			{error && <Alert type="error">{error}</Alert>}

			<form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<FormField
					label="Nama Keluarga"
					value={formData.name}
					onChange={(v) => setFormData({ ...formData, name: v })}
					required
					disabled={submitting}
				/>
				<div>
					<FormField
						label="Jumlah Keluarga (jiwa)"
						type="number"
						value={formData.totalFamily}
						onChange={(v) => setFormData({ ...formData, totalFamily: v })}
						readOnly
						disabled
					/>
					<p className="-mt-2 mb-4 text-xs text-slate-500">
						Jumlah anggota keluarga tercatat permanen untuk menjaga sinkronisasi okupansi posko. Bila ada perubahan jumlah jiwa, daftarkan data anggota tambahan secara terpisah.
					</p>
				</div>
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
					placeholder="Catatan kesehatan atau kebutuhan khusus"
					disabled={submitting}
				/>
				<div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end sm:gap-3 sm:pt-0">
					<Link href={`/pengungsi/${evacuee.id}`}>
						<Button type="button" variant="secondary" disabled={submitting}>
							Batal
						</Button>
					</Link>
					<Button type="submit" disabled={submitting}>
						{submitting ? "Menyimpan..." : "Simpan Perubahan"}
					</Button>
				</div>
			</form>
		</div>
	);
}
