"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSelect } from "@/components/ui/form-field";

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

export default function CampEditPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [camp, setCamp] = useState<Camp | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		address: "",
		latitude: "",
		longitude: "",
		maxCapacity: "",
		status: "",
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!id) return;

		fetch(`/api/camps/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setCamp(data.data);
					setFormData({
						name: data.data.name,
						address: data.data.address,
						latitude: String(data.data.latitude),
						longitude: String(data.data.longitude),
						maxCapacity: String(data.data.maxCapacity),
						status: data.data.status,
					});
				} else {
					setError(data.message ?? "Gagal memuat data posko");
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
			const res = await fetch(`/api/camps/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					latitude: Number(formData.latitude),
					longitude: Number(formData.longitude),
					maxCapacity: Number(formData.maxCapacity),
				}),
			});

			const data = await res.json();

			if (data.success) {
				router.push(`/kelola-posko/${id}`);
				router.refresh();
			} else {
				setError(data.message ?? "Gagal memperbarui posko");
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

	if (!camp) {
		return <Alert type="info">Posko tidak ditemukan.</Alert>;
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">
				Edit Posko: {camp.name}
			</h1>

			{error && <Alert type="error">{error}</Alert>}

			<form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<FormField
					label="Nama"
					value={formData.name}
					onChange={(v) =>
						setFormData({ ...formData, name: v })
					}
					required
				/>
				<FormField
					label="Alamat"
					value={formData.address}
					onChange={(v) =>
						setFormData({ ...formData, address: v })
					}
					required
				/>
				<FormField
					label="Latitude"
					type="number"
					step="0.0001"
					value={formData.latitude}
					onChange={(v) =>
						setFormData({ ...formData, latitude: v })
					}
					required
				/>
				<FormField
					label="Longitude"
					type="number"
					step="0.0001"
					value={formData.longitude}
					onChange={(v) =>
						setFormData({ ...formData, longitude: v })
					}
					required
				/>
				<FormField
					label="Kapasitas Maksimal"
					type="number"
					value={formData.maxCapacity}
					onChange={(v) =>
						setFormData({ ...formData, maxCapacity: v })
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
						{ value: "ACTIVE", label: "ACTIVE" },
						{ value: "CLOSED", label: "CLOSED" },
					]}
					required
				/>
				<div className="flex justify-end gap-3 mt-6">
					<Link href={`/kelola-posko/${camp.id}`}>
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
