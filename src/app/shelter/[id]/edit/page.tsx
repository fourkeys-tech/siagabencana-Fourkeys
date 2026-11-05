"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSelect } from "@/components/ui/form-field";
import { enumLabel } from "@/lib/labels";
import { FACILITY_CATEGORIES, FACILITY_CATEGORY_INFO, type FacilityCategory } from "@/lib/shelter-standards";

interface FacilityReport {
	id: string;
	campId: string;
	category: FacilityCategory;
	facilityName: string;
	quantity: number;
	status: "GOOD" | "DAMAGED" | "REPAIRING";
	description: string;
}

const categoryOptions = FACILITY_CATEGORIES.map((category) => ({ value: category, label: FACILITY_CATEGORY_INFO[category].label }));

export default function ShelterEditPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [report, setReport] = useState<FacilityReport | null>(null);
	const [formData, setFormData] = useState({
		category: "OTHER" as FacilityCategory,
		facilityName: "",
		quantity: "1",
		description: "",
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!id) return;

		fetch(`/api/shelter/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setReport(data.data);
					setFormData({
						category: data.data.category,
						facilityName: data.data.facilityName,
						quantity: String(data.data.quantity),
						description: data.data.description,
					});
				} else {
					setError(data.message ?? "Gagal memuat laporan shelter");
				}
			})
			.catch(() => setError("Terjadi kesalahan koneksi"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setSubmitting(true);
		setError("");

		try {
			const response = await fetch(`/api/shelter/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});
			const data = await response.json();

			if (!response.ok || !data.success) {
				throw new Error(data.message ?? "Gagal memperbarui laporan shelter");
			}
			router.push(`/shelter/${id}`);
			router.refresh();
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Terjadi kesalahan");
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

	if (error && !report) {
		return (
			<div className="space-y-4">
				<Alert type="error">{error}</Alert>
				<Link href="/shelter"><Button variant="secondary">Kembali ke Shelter</Button></Link>
			</div>
		);
	}

	if (!report) {
		return (
			<div className="space-y-4">
				<Alert type="info">Laporan fasilitas tidak ditemukan.</Alert>
				<Link href="/shelter"><Button variant="secondary">Kembali ke Shelter</Button></Link>
			</div>
		);
	}

	const info = FACILITY_CATEGORY_INFO[formData.category];

	return (
		<div className="w-full max-w-3xl min-w-0 space-y-6">
			<div>
				<Link href={`/shelter/${report.id}`} className="text-sm font-medium text-blue-600 hover:underline">
					← Kembali ke Detail Laporan
				</Link>
				<h1 className="mt-1 text-2xl font-bold text-gray-900">
					Edit Laporan Shelter: {report.facilityName}
				</h1>
			</div>

			{error && <Alert type="error">{error}</Alert>}

			<form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<FormSelect
					label="Kategori"
					value={formData.category}
					onChange={(value) => setFormData((current) => ({ ...current, category: value as FacilityCategory }))}
					options={categoryOptions}
					required
					disabled={submitting}
				/>
				<p className="-mt-2 text-xs text-slate-500">Standar: {info.standardLabel}.</p>
				<FormField
					label="Nama Fasilitas"
					value={formData.facilityName}
					onChange={(value) => setFormData((current) => ({ ...current, facilityName: value }))}
					required
					disabled={submitting}
				/>
				<FormField
					label={info.quantityLabel}
					type="number"
					min={1}
					step={1}
					value={formData.quantity}
					onChange={(value) => setFormData((current) => ({ ...current, quantity: value }))}
					required
					disabled={submitting}
				/>
				<div className="space-y-1.5">
					<p className="block text-xs font-bold uppercase tracking-wide text-slate-600">Status saat ini</p>
					<div className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-700">
						{enumLabel(report.status)}
					</div>
					<p className="text-xs text-slate-500">Gunakan menu aksi pada daftar shelter untuk melapor rusak, memulai, atau menyelesaikan perbaikan.</p>
				</div>
				<FormField
					label="Deskripsi"
					value={formData.description}
					onChange={(value) => setFormData((current) => ({ ...current, description: value }))}
					required
					disabled={submitting}
				/>
				<div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end sm:gap-3 sm:pt-0">
					<Link href={`/shelter/${report.id}`}>
						<Button type="button" variant="secondary" disabled={submitting}>Batal</Button>
					</Link>
					<Button type="submit" disabled={submitting}>
						{submitting ? "Menyimpan..." : "Simpan Perubahan"}
					</Button>
				</div>
			</form>
		</div>
	);
}
