"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";

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
		hasSpecialNeeds: "",
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
					setError(data.message ?? "Gagal memuat data pengungsi");
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
			const res = await fetch(`/api/evacuees/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					totalFamily: Number(formData.totalFamily),
					hasSpecialNeeds: formData.hasSpecialNeeds === "true",
					notes: formData.notes || null,
				}),
			});

			const data = await res.json();

			if (data.success) {
				router.push(`/pengungsi/${id}`);
				router.refresh();
			} else {
				setError(data.message ?? "Gagal memperbarui data pengungsi");
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

	if (!evacuee) {
		return <Alert type="info">Data pengungsi tidak ditemukan.</Alert>;
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">
				Edit Pengungsi: {evacuee.name}
			</h1>

			{error && <Alert type="error">{error}</Alert>}

			<form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<FormField
					label="Nama Keluarga"
					value={formData.name}
					onChange={(v) =>
						setFormData({ ...formData, name: v })
					}
					required
				/>
				<FormField
					label="Jumlah Keluarga"
					type="number"
					value={formData.totalFamily}
					onChange={(v) =>
						setFormData({ ...formData, totalFamily: v })
					}
					required
				/>
				<FormField
					label="Butuh Khusus (true/false)"
					value={formData.hasSpecialNeeds}
					onChange={(v) =>
						setFormData({ ...formData, hasSpecialNeeds: v })
					}
					required
				/>
				<FormField
					label="Catatan"
					value={formData.notes}
					onChange={(v) =>
						setFormData({ ...formData, notes: v })
					}
				/>
				<div className="flex justify-end gap-3 mt-6">
					<Link href={`/pengungsi/${evacuee.id}`}>
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
