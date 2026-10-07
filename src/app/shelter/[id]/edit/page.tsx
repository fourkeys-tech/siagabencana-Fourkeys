"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";

interface FacilityReport {
	id: string;
	campId: string;
	facilityName: string;
	status: "GOOD" | "DAMAGED" | "REPAIRING";
	description: string;
}

export default function ShelterEditPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [report, setReport] = useState<FacilityReport | null>(null);
	const [formData, setFormData] = useState({
		facilityName: "",
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
						facilityName: data.data.facilityName,
						description: data.data.description,
					});
				} else {
					setError(data.message ?? "Gagal memuat laporan shelter");
				}
			})
			.catch(() => setError("Terjadi kesalahan"))
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
				body: JSON.stringify({
					facilityName: formData.facilityName,
					description: formData.description,
				}),
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

	if (error && !report) return <Alert type="error">{error}</Alert>;
	if (!report) return <Alert type="info">Laporan fasilitas tidak ditemukan.</Alert>;

	return (
		<div className="w-full max-w-3xl min-w-0 space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">Edit Laporan Shelter: {report.facilityName}</h1>
			{error && <Alert type="error">{error}</Alert>}
			<form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<FormField
					label="Nama Fasilitas"
					value={formData.facilityName}
					onChange={(value) => setFormData((current) => ({ ...current, facilityName: value }))}
					required
				/>
				<div className="space-y-1.5">
					<p className="block text-xs font-bold uppercase tracking-wide text-slate-600">Status saat ini</p>
					<div className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-700">{report.status}</div>
					<p className="text-xs text-slate-500">Gunakan menu aksi pada daftar shelter untuk memulai atau menyelesaikan perbaikan.</p>
				</div>
				<FormField
					label="Deskripsi"
					value={formData.description}
					onChange={(value) => setFormData((current) => ({ ...current, description: value }))}
					required
				/>
				<div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end sm:gap-3 sm:pt-0">
					<Link href={`/shelter/${report.id}`}>
						<Button type="button" variant="secondary">Batal</Button>
					</Link>
					<Button type="submit" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Perubahan"}</Button>
				</div>
			</form>
		</div>
	);
}
