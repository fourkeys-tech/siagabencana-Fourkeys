"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface LogisticsItem {
	id: string;
	campId: string;
	itemName: string;
	quantity: number;
	unit: string;
	status: string;
	notes: string | null;
}

export default function LogisticsEditPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [item, setItem] = useState<LogisticsItem | null>(null);
	const [formData, setFormData] = useState({
		itemName: "",
		quantity: "",
		unit: "",
		status: "",
		notes: "",
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!id) return;

		fetch(`/api/logistics/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setItem(data.data);
					setFormData({
						itemName: data.data.itemName,
						quantity: String(data.data.quantity),
						unit: data.data.unit,
						status: data.data.status,
						notes: data.data.notes ?? "",
					});
				} else {
					setError(data.message ?? "Gagal memuat data logistik");
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
			const res = await fetch(`/api/logistics/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					itemName: formData.itemName,
					quantity: Number(formData.quantity),
					unit: formData.unit,
					status: formData.status,
					notes: formData.notes || null,
				}),
			});

			const data = await res.json();

			if (data.success) {
				router.push(`/logistik/${id}`);
				router.refresh();
			} else {
				setError(data.message ?? "Gagal memperbarui data logistik");
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

	if (!item) {
		return <Alert type="info">Item logistik tidak ditemukan.</Alert>;
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-gray-900">
				Edit Logistik: {item.itemName}
			</h1>

			{error && <Alert type="error">{error}</Alert>}

			<form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<FormField
					label="Nama Barang"
					value={formData.itemName}
					onChange={(v) =>
						setFormData({ ...formData, itemName: v })
					}
					required
				/>
				<FormField
					label="Jumlah"
					type="number"
					value={formData.quantity}
					onChange={(v) =>
						setFormData({ ...formData, quantity: v })
					}
					required
				/>
				<FormField
					label="Unit"
					value={formData.unit}
					onChange={(v) =>
						setFormData({ ...formData, unit: v })
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
						{ value: "SUFFICIENT", label: "SUFFICIENT" },
						{ value: "LOW", label: "LOW" },
						{ value: "CRITICAL", label: "CRITICAL" },
						{ value: "SPOILED_OR_DAMAGED", label: "SPOILED_OR_DAMAGED" },
					]}
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
					<Link href={`/logistik/${item.id}`}>
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
