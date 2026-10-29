"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (!id) return;

		fetch(`/api/shelter/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.success) setReport(data.data);
				else setError(data.message ?? "Gagal memuat laporan shelter");
			})
			.catch(() => setError("Terjadi kesalahan koneksi"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleDelete = async () => {
		if (!report) return;
		setDeleting(true);
		setError("");

		try {
			const res = await fetch(`/api/shelter/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				router.push("/shelter");
				router.refresh();
			} else {
				setError(data.message ?? "Gagal menghapus laporan.");
				setConfirmDelete(false);
			}
		} catch {
			setError("Terjadi kesalahan saat menghapus laporan.");
			setConfirmDelete(false);
		} finally {
			setDeleting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<span className="text-gray-500 text-lg">Memuat...</span>
			</div>
		);
	}

	if (error && !report) {
		return (
			<div className="space-y-4">
				<Alert type="error">{error}</Alert>
				<Link href="/shelter"><Button variant="secondary">Kembali ke Shelter</Button></Link>
			</div>
		);
	}

	if (!report) {
		return (
			<div className="space-y-4">
				<Alert type="info">Laporan fasilitas tidak ditemukan.</Alert>
				<Link href="/shelter"><Button variant="secondary">Kembali ke Shelter</Button></Link>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<Link href="/shelter" className="text-sm font-medium text-blue-600 hover:underline">
						← Kembali ke Shelter
					</Link>
					<h1 className="mt-1 text-2xl font-bold text-gray-900">
						Detail Laporan Shelter: {report.facilityName}
					</h1>
				</div>
				<div className="flex gap-2">
					<Link href={`/shelter/${report.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					<Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={deleting}>
						{deleting ? "Menghapus..." : "Hapus"}
					</Button>
				</div>
			</div>

			{error && <Alert type="error">{error}</Alert>}

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
					<p className="text-gray-900">{report.camp?.name ?? "-"}</p>
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

			<ConfirmDialog
				isOpen={confirmDelete}
				title="Hapus Laporan Fasilitas"
				message={`Apakah Anda yakin ingin menghapus laporan fasilitas "${report.facilityName}"? Penghapusan tidak dapat dibatalkan.`}
				confirmLabel="Hapus Laporan"
				variant="danger"
				busy={deleting}
				onConfirm={handleDelete}
				onClose={() => setConfirmDelete(false)}
			/>
		</div>
	);
}
