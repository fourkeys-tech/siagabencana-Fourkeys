"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { MapCamp } from "@/components/public/camp-map";

const CampMap = dynamic(() => import("@/components/public/camp-map").then((module) => module.CampMap), { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">Memuat peta...</div> });
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
			<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

			<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-6">
				<div className="h-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><CampMap camps={[{ id: camp.id, name: camp.name, address: camp.address, latitude: camp.latitude, longitude: camp.longitude, maxCapacity: camp.maxCapacity, currentOccupants: camp.currentOccupants, occupancyPercentage: camp.maxCapacity > 0 ? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(2)) : 0, status: camp.status } satisfies MapCamp]} activeId={camp.id} /></div>
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
		</div>
	);
}
