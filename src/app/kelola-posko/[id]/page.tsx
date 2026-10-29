"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "@/components/auth/user-provider";
import type { MapCamp } from "@/components/public/camp-map";

const CampMap = dynamic(() => import("@/components/public/camp-map").then((module) => module.CampMap), { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">Memuat peta...</div> });
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
	const { user } = useSession();
	const canManageCamps = user?.role === "SUPER_ADMIN";

	const [camp, setCamp] = useState<Camp | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);

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
		setDeleting(true);
		setError("");

		try {
			const res = await fetch(`/api/camps/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				router.push("/kelola-posko");
				router.refresh();
			} else {
				setError(data.message ?? "Gagal menghapus posko.");
				setConfirmDelete(false);
			}
		} catch {
			setError("Terjadi kesalahan saat menghapus posko.");
			setConfirmDelete(false);
		} finally {
			setDeleting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<span className="text-lg text-gray-500">
					Memuat...
				</span>
			</div>
		);
	}

	if (error && !camp) {
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
				{canManageCamps && (
					<div className="flex gap-2">
						<Link href={`/kelola-posko/${camp.id}/edit`}>
							<Button variant="secondary">Edit</Button>
						</Link>
						<Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={deleting}>
							{deleting ? "Menghapus..." : "Hapus"}
						</Button>
					</div>
				)}
			</div>

			{error && <Alert type="error">{error}</Alert>}

			<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-6">
				<div className="h-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<CampMap
						camps={[{
							id: camp.id,
							name: camp.name,
							address: camp.address,
							latitude: camp.latitude,
							longitude: camp.longitude,
							maxCapacity: camp.maxCapacity,
							currentOccupants: camp.currentOccupants,
							occupancyPercentage: camp.maxCapacity > 0 ? Number(((camp.currentOccupants / camp.maxCapacity) * 100).toFixed(2)) : 0,
							status: camp.status,
						} satisfies MapCamp]}
						activeId={camp.id}
					/>
				</div>
				<div className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
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

			<ConfirmDialog
				isOpen={confirmDelete}
				title="Hapus Posko"
				message={`Apakah Anda yakin ingin menghapus posko "${camp.name}"? Tindakan ini tidak dapat dibatalkan.`}
				confirmLabel="Hapus Posko"
				variant="danger"
				busy={deleting}
				onConfirm={handleDelete}
				onClose={() => setConfirmDelete(false)}
			/>
		</div>
	);
}
