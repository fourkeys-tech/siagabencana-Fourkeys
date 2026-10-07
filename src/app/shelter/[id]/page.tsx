"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface FacilityReport {
	id: string;
	campId: string;
	camp: { name: string };
	facilityName: string;
	status: string;
	description: string;
	createdAt: string;
	updatedAt: string;
}

export default function ShelterDetailPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [report, setReport] = useState<FacilityReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!id) return;

		fetch(`/api/shelter/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setReport(data.data);
				else setError(data.message ?? "Gagal memuat laporan shelter");
			})
			.catch(() => setError("Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleDelete = async () => {
		if (!report) return;
		if (!confirm(`Hapus laporan fasilitas "${report.facilityName}"?`)) return;

		try {
			const res = await fetch(`/api/shelter/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				router.push("/shelter");
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

	if (!report) {
		return <Alert type="info">Laporan fasilitas tidak ditemukan.</Alert>;
	}

	return (
		<div className="space-y-6">
			<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-2xl font-bold text-gray-900">
					Detail Laporan Shelter: {report.facilityName}
				</h1>
				<div className="flex gap-2">
					<Link href={`/shelter/${report.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					<Button variant="danger" onClick={handleDelete}>
						Hapus
					</Button>
				</div>
			</div>

			<div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
				<div>
					<p className="text-sm font-medium text-gray-500">Nama Fasilitas</p>
					<p className="text-gray-900">{report.facilityName}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Status</p>
					<Badge label={report.status} />
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Deskripsi</p>
					<p className="text-gray-900">{report.description}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Posko</p>
					<p className="text-gray-900">{report.camp?.name}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Dibuat Pada</p>
					<p className="text-gray-900">
						{new Date(report.createdAt).toLocaleString("id-ID")}
					</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Diperbarui Pada</p>
					<p className="text-gray-900">
						{new Date(report.updatedAt).toLocaleString("id-ID")}
					</p>
				</div>
			</div>
		</div>
	);
}
