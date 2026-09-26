"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Camp {
	id: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	currentOccupants: number;
	status: string;
	createdAt: string;
	updatedAt: string;
}

export default function CampDetailPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [camp, setCamp] = useState<Camp | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!id) return;

		fetch(`/api/camps/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setCamp(data.data);
				else setError(data.message ?? "Gagal memuat data posko");
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleDelete = async () => {
		if (!camp) return;
		if (!confirm(`Hapus posko "${camp.name}"?`)) return;

		try {
			const res = await fetch(`/api/camps/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				router.push("/kelola-posko");
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

	if (!camp) {
		return <Alert type="info">Posko tidak ditemukan.</Alert>;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">
					Detail Posko: {camp.name}
				</h1>
				<div className="flex gap-2">
					<Link href={`/kelola-posko/${camp.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					<Button variant="danger" onClick={handleDelete}>
						Hapus
					</Button>
				</div>
			</div>

			<div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<div>
					<p className="text-sm font-medium text-gray-500">Nama</p>
					<p className="text-gray-900">{camp.name}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Alamat</p>
					<p className="text-gray-900">{camp.address}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Latitude</p>
					<p className="text-gray-900">{camp.latitude}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Longitude</p>
					<p className="text-gray-900">{camp.longitude}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Kapasitas Maksimal</p>
					<p className="text-gray-900">{camp.maxCapacity}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Penghuni Saat Ini</p>
					<p className="text-gray-900">{camp.currentOccupants}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Status</p>
					<Badge label={camp.status} />
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Dibuat Pada</p>
					<p className="text-gray-900">
						{new Date(camp.createdAt).toLocaleString("id-ID")}
					</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Diperbarui Pada</p>
					<p className="text-gray-900">
						{new Date(camp.updatedAt).toLocaleString("id-ID")}
					</p>
				</div>
			</div>
		</div>
	);
}
