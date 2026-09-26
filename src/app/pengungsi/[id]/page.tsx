"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Evacuee {
	id: string;
	campId: string;
	camp: { name: string };
	name: string;
	totalFamily: number;
	hasSpecialNeeds: boolean;
	notes: string | null;
	arrivedAt: string;
	departedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export default function EvacueeDetailPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [evacuee, setEvacuee] = useState<Evacuee | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!id) return;

		fetch(`/api/evacuees/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setEvacuee(data.data);
				else setError(data.message ?? "Gagal memuat data pengungsi");
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleCheckout = async () => {
		if (!evacuee) return;
		if (!confirm(`Konfirmasi check-out pengungsi "${evacuee.name}"?`)) return;

		try {
			const res = await fetch(`/api/evacuees/${id}/checkout`, { method: "POST" });
			const data = await res.json();
			if (data.success) {
				router.refresh();
			} else {
				setError(data.message);
			}
		} catch {
			setError("Terjadi kesalahan");
		}
	};

	const handleDelete = async () => {
		if (!evacuee) return;
		if (!confirm(`Hapus pengungsi "${evacuee.name}"?`)) return;

		try {
			const res = await fetch(`/api/evacuees/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				router.push("/pengungsi");
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

	if (!evacuee) {
		return <Alert type="info">Data pengungsi tidak ditemukan.</Alert>;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-gray-900">
					Detail Pengungsi: {evacuee.name}
				</h1>
				<div className="flex gap-2">
					<Link href={`/pengungsi/${evacuee.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					{!evacuee.departedAt && (
						<Button onClick={handleCheckout} variant="primary">
							Check-out
						</Button>
					)}
					<Button variant="danger" onClick={handleDelete}>
						Hapus
					</Button>
				</div>
			</div>

			<div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<div>
					<p className="text-sm font-medium text-gray-500">Nama Keluarga</p>
					<p className="text-gray-900">{evacuee.name}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Jumlah Keluarga</p>
					<p className="text-gray-900">{evacuee.totalFamily} orang</p>
					</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Butuh Khusus</p>
					{evacuee.hasSpecialNeeds ? (
						<Badge label="YA" />
					) : (
						<span className="text-gray-400">Tidak</span>
					)}
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Catatan</p>
					<p className="text-gray-900">{evacuee.notes ?? "-"}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Posko</p>
					<p className="text-gray-900">{evacuee.camp?.name}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Tanggal Kedatangan</p>
					<p className="text-gray-900">
						{new Date(evacuee.arrivedAt).toLocaleString("id-ID")}
					</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Tanggal Keberangkatan</p>
					<p className="text-gray-900">
						{evacuee.departedAt
							? new Date(evacuee.departedAt).toLocaleString("id-ID")
							: "Belum check-out"}
					</p>
				</div>
			</div>
		</div>
	);
}
