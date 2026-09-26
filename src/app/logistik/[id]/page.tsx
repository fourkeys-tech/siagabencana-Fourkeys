"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface LogisticsItem {
	id: string;
	campId: string;
	camp: { name: string };
	itemName: string;
	quantity: number;
	unit: string;
	status: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export default function LogisticsDetailPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [item, setItem] = useState<LogisticsItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!id) return;

		fetch(`/api/logistics/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setItem(data.data);
				else setError(data.message ?? "Gagal memuat data logistik");
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleDelete = async () => {
		if (!item) return;
		if (!confirm(`Hapus item logistik "${item.itemName}"?`)) return;

		try {
			const res = await fetch(`/api/logistics/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				router.push("/logistik");
				router.refresh();
			} else {
				setError(data.message);
			}
		} catch {
			setError("Terjadi kesalahan");
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
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">
					Detail Logistik: {item.itemName}
				</h1>
				<div className="flex gap-2">
					<Link href={`/logistik/${item.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					<Button variant="danger" onClick={handleDelete}>
						Hapus
					</Button>
				</div>
			</div>

			<div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<div>
					<p className="text-sm font-medium text-gray-500">Nama Barang</p>
					<p className="text-gray-900">{item.itemName}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Jumlah</p>
					<p className="text-gray-900">{item.quantity} {item.unit}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Status</p>
					<Badge label={item.status} />
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Catatan</p>
					<p className="text-gray-900">{item.notes ?? "-"}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Posko</p>
					<p className="text-gray-900">{item.camp?.name}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Dibuat Pada</p>
					<p className="text-gray-900">
						{new Date(item.createdAt).toLocaleString("id-ID")}
					</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Diperbarui Pada</p>
					<p className="text-gray-900">
						{new Date(item.updatedAt).toLocaleString("id-ID")}
					</p>
				</div>
			</div>
		</div>
	);
}
