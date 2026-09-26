"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface FacilityReport {
	id: string;
	campId: string;
	facilityName: string;
	status: string;
	description: string;
}

export default function ShelterEditPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [report, setReport] = useState<FacilityReport | null>(null);
	const [formData, setFormData] = useState({
		facilityName: "",
		status: "",
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
						status: data.data.status,
						description: data.data.description,
					});
				} else {
					setError(data.message ?? "Gagal memuat laporan shelter");
				}
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setError("");

		try {
			const res = await fetch(`/api/shelter/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					facilityName: formData.facilityName,
					status: formData.status,
					description: formData.description,
				}),
			});

			const data = await res.json();

			if (data.success) {
				router.push(`/shelter/${id}`);
				router.refresh();
			} else {
				setError(data.message ?? "Gagal memperbarui laporan shelter");
			}
		} catch {
			setError("Terjadi kesalahan");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<span className="text-gray-500 text-lg">
					Memuat...
				</span>
			</div>
		);
	}

	if (error) {
		return <Alert type="error">{error}</Alert>;
	}

	if (!report) {
		return <Alert type="info">Laporan fasilitas tidak ditemukan.</Alert>;
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">
				Edit Laporan Shelter: {report.facilityName}
			</h1>

			{error && <Alert type="error">{error}</Alert>}

			<form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<FormField
					label="Nama Fasilitas"
					value={formData.facilityName}
					onChange={(v) =>
						setFormData({ ...formData, facilityName: v })
					}
					required
				/>
				<FormSelect
					label="Status"
					value={formData.status}
					onChange={(v) =>
						setFormData({ ...formData, status: v })
					}
					options={[
						{ value: "GOOD", label: "GOOD" },
						{ value: "DAMAGED", label: "DAMAGED" },
						{ value: "REPAIRING", label: "REPAIRING" },
					]}
					required
				/>
				<FormField
					label="Deskripsi"
					value={formData.description}
					onChange={(v) =>
						setFormData({ ...formData, description: v })
					}
					required
				/>
				<div className="flex justify-end gap-3 mt-6">
					<Link href={`/shelter/${report.id}`}>
						<Button type="button" variant="secondary">
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
