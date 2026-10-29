"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [confirmAction, setConfirmAction] = useState<{
		title: string;
		message: string;
		confirmLabel?: string;
		variant?: "primary" | "danger";
		onConfirm: () => void | Promise<void>;
	} | null>(null);

	const loadData = useCallback(async () => {
		if (!id) return;
		try {
			const res = await fetch(`/api/evacuees/${id}`);
			const data = await res.json();
			if (data.success) {
				setEvacuee(data.data);
				setError("");
			} else {
				setError(data.message ?? "Gagal memuat data pengungsi.");
			}
		} catch {
			setError("Terjadi kesalahan koneksi.");
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const executeCheckout = async () => {
		if (!evacuee) return;
		setSubmitting(true);
		setError("");

		try {
			const res = await fetch(`/api/evacuees/${id}/checkout`, { method: "POST" });
			const data = await res.json();
			if (data.success) {
				await loadData();
			} else {
				setError(data.message ?? "Gagal melakukan check-out.");
			}
		} catch {
			setError("Terjadi kesalahan koneksi saat check-out.");
		} finally {
			setSubmitting(false);
		}
	};

	const executeDelete = async () => {
		if (!evacuee) return;
		setSubmitting(true);
		setError("");

		try {
			const res = await fetch(`/api/evacuees/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				router.push("/pengungsi");
				router.refresh();
			} else {
				setError(data.message ?? "Gagal menghapus data pengungsi.");
			}
		} catch {
			setError("Terjadi kesalahan koneksi saat menghapus.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleCheckout = () => {
		if (!evacuee) return;
		setConfirmAction({
			title: "Konfirmasi Check-out",
			message: `Konfirmasi check-out untuk pengungsi "${evacuee.name}" (${evacuee.totalFamily} jiwa)? Posko akan memperbarui kapasitas tersedia.`,
			confirmLabel: "Check-out Sekarang",
			variant: "primary",
			onConfirm: executeCheckout,
		});
	};

	const handleDelete = () => {
		if (!evacuee) return;
		setConfirmAction({
			title: "Hapus Data Pengungsi",
			message: `Apakah Anda yakin ingin menghapus data pengungsi "${evacuee.name}"? Data yang dihapus tidak dapat dipulihkan.`,
			confirmLabel: "Hapus Pengungsi",
			variant: "danger",
			onConfirm: executeDelete,
		});
	};

	if (loading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<span className="text-lg text-gray-500">Memuat...</span>
			</div>
		);
	}

	if (error && !evacuee) {
		return (
			<div className="space-y-4">
				<Alert type="error">{error}</Alert>
				<Link href="/pengungsi"><Button variant="secondary">Kembali ke Daftar Pengungsi</Button></Link>
			</div>
		);
	}

	if (!evacuee) {
		return (
			<div className="space-y-4">
				<Alert type="info">Data pengungsi tidak ditemukan.</Alert>
				<Link href="/pengungsi"><Button variant="secondary">Kembali ke Daftar Pengungsi</Button></Link>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<Link href="/pengungsi" className="text-sm font-medium text-blue-600 hover:underline">
						← Kembali ke Daftar Pengungsi
					</Link>
					<h1 className="mt-1 text-2xl font-bold text-gray-900">
						Detail Pengungsi: {evacuee.name}
					</h1>
				</div>
				<div className="flex gap-2">
					<Link href={`/pengungsi/${evacuee.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					{!evacuee.departedAt && (
						<Button onClick={handleCheckout} variant="primary" disabled={submitting}>
							Check-out
						</Button>
					)}
					<Button variant="danger" onClick={handleDelete} disabled={submitting}>
						Hapus
					</Button>
				</div>
			</div>

			{error && <Alert type="error">{error}</Alert>}

			<div className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
				<div>
					<p className="text-sm font-medium text-gray-500">Nama Keluarga</p>
					<p className="text-gray-900">{evacuee.name}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Jumlah Keluarga</p>
					<p className="text-gray-900">{evacuee.totalFamily} orang</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Kebutuhan Khusus</p>
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
					<p className="text-sm font-medium text-gray-500">Status Keberangkatan</p>
					<p className="text-gray-900">
						{evacuee.departedAt
							? `Check-out pada ${new Date(evacuee.departedAt).toLocaleString("id-ID")}`
							: "Masih berada di posko"}
					</p>
				</div>
			</div>

			{confirmAction && (
				<ConfirmDialog
					isOpen={Boolean(confirmAction)}
					title={confirmAction.title}
					message={confirmAction.message}
					confirmLabel={confirmAction.confirmLabel}
					variant={confirmAction.variant}
					busy={submitting}
					onConfirm={async () => {
						const action = confirmAction.onConfirm;
						await action();
						setConfirmAction(null);
					}}
					onClose={() => setConfirmAction(null)}
				/>
			)}
		</div>
	);
}
