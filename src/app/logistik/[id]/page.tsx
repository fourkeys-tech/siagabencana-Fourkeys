"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { enumLabel } from "@/lib/labels";

interface LogisticsItem {
	id: string;
	camp: { name: string };
	itemName: string;
	quantity: number;
	reservedQuantity: number;
	damagedQuantity: number;
	minimumQuantity: number;
	unit: string;
	baseUnit: string;
	unitDimension: "COUNT" | "MASS" | "VOLUME";
	conversionFactor: number;
	conversionStatus: "CONFIGURED" | "NEEDS_REVIEW";
	conversionNote: string | null;
	quantityBase: number;
	reservedQuantityBase: number;
	damagedQuantityBase: number;
	minimumQuantityBase: number;
	status: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

interface InventoryMovement {
	id: string;
	type: string;
	quantity: number;
	baseQuantity: number | null;
	baseUnit: string | null;
	reason: string | null;
	createdAt: string;
	createdBy: { id: string; name: string } | null;
}

export default function LogisticsDetailPage() {
	const params = useParams();
	const router = useRouter();
	const id = params.id;

	const [item, setItem] = useState<LogisticsItem | null>(null);
	const [movements, setMovements] = useState<InventoryMovement[]>([]);
	const [movementsTotal, setMovementsTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (!id || typeof id !== "string") return;

		Promise.all([
			fetch(`/api/logistics/${id}`).then((res) => res.json()),
			fetch(`/api/logistics/${id}/movements`).then((res) => res.json()),
		])
			.then(([itemData, movementsData]) => {
				if (itemData.success) {
					setItem(itemData.data);
				} else {
					setError(itemData.message ?? "Gagal memuat data logistik");
				}

				if (movementsData.success) {
					if (Array.isArray(movementsData.data)) {
						setMovements(movementsData.data);
						setMovementsTotal(movementsData.pagination?.total ?? movementsData.data.length);
					}
				}
			})
			.catch(() => setError("Terjadi kesalahan koneksi"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleDelete = async () => {
		if (!item) return;
		setDeleting(true);
		setError("");

		try {
			const res = await fetch(`/api/logistics/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message ?? "Gagal menghapus item logistik.");
			router.push("/logistik");
			router.refresh();
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "Terjadi kesalahan");
			setConfirmDelete(false);
		} finally {
			setDeleting(false);
		}
	};

	if (loading) {
		return <div className="flex h-64 items-center justify-center text-gray-500">Memuat...</div>;
	}

	if (error && !item) {
		return (
			<div className="space-y-4">
				<Alert type="error">{error}</Alert>
				<Link href="/logistik"><Button variant="secondary">Kembali ke Logistik</Button></Link>
			</div>
		);
	}

	if (!item) {
		return (
			<div className="space-y-4">
				<Alert type="info">Item logistik tidak ditemukan.</Alert>
				<Link href="/logistik"><Button variant="secondary">Kembali ke Logistik</Button></Link>
			</div>
		);
	}

	const hasMovements = movementsTotal > 0 || movements.length > 0;

	return (
		<div className="space-y-6">
			<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<Link href="/logistik" className="text-sm font-medium text-blue-600 hover:underline">
						← Kembali ke Logistik
					</Link>
					<h1 className="mt-1 text-2xl font-bold text-gray-900">
						Detail Logistik: {item.itemName}
					</h1>
				</div>
				<div className="flex items-center gap-2">
					<Link href={`/logistik/${item.id}/edit`}>
						<Button variant="secondary">Edit</Button>
					</Link>
					{!hasMovements ? (
						<Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={deleting}>
							{deleting ? "Menghapus..." : "Hapus"}
						</Button>
					) : (
						<div
							title="Item memiliki riwayat mutasi stok. Gunakan tindakan stok (Dispose) untuk memusnahkan barang rusak."
							className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500"
						>
							Terkunci Riwayat Mutasi
						</div>
					)}
				</div>
			</div>

			{error && <Alert type="error">{error}</Alert>}

			{hasMovements && (
				<Alert type="info">
					Item ini telah memiliki catatan pergerakan stok. Penghapusan dinonaktifkan demi integritas buku besar. Untuk barang rusak atau kedaluwarsa, gunakan fitur <b>Pemusnahan (Dispose)</b> melalui menu tindakan stok.
				</Alert>
			)}

			<div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
				<div>
					<p className="text-sm font-medium text-gray-500">Nama Barang</p>
					<p className="text-gray-900 font-semibold">{item.itemName}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Posko</p>
					<p className="text-gray-900">{item.camp?.name ?? "-"}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Stok layak pakai</p>
					<p className="text-gray-900 font-semibold">{item.quantity} {item.unit}</p>
					<p className="text-xs text-gray-500">Tersedia: {Math.max(item.quantity - item.reservedQuantity, 0)} {item.unit}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Saldo dasar kanonik</p>
					<p className="text-gray-900 font-semibold">{item.quantityBase} {item.baseUnit}</p>
					<p className="text-xs text-gray-500">Tersedia: {Math.max(item.quantityBase - item.reservedQuantityBase, 0)} {item.baseUnit}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Dicadangkan (Reserved)</p>
					<p className="text-gray-900">{item.reservedQuantity} {item.unit} · {item.reservedQuantityBase} {item.baseUnit}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Rusak / Kedaluwarsa</p>
					<p className="text-gray-900">{item.damagedQuantity} {item.unit} · {item.damagedQuantityBase} {item.baseUnit}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Definisi Satuan</p>
					<p className="text-gray-900">1 {item.unit} = {item.conversionFactor} {item.baseUnit}</p>
					<p className="text-xs text-gray-500">Dimensi: {item.unitDimension}</p>
					{item.conversionStatus === "NEEDS_REVIEW" && (
						<p className="mt-1 text-xs font-semibold text-amber-700">Perlu verifikasi isi kemasan</p>
					)}
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Status Operasional</p>
					<Badge label={item.status} />
				</div>
				<div className="sm:col-span-2">
					<p className="text-sm font-medium text-gray-500">Catatan Definisi</p>
					<p className="text-gray-900">{item.conversionNote ?? "-"}</p>
				</div>
				<div className="sm:col-span-2">
					<p className="text-sm font-medium text-gray-500">Catatan Tambahan</p>
					<p className="text-gray-900">{item.notes ?? "-"}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Dibuat Pada</p>
					<p className="text-gray-900">{new Date(item.createdAt).toLocaleString("id-ID")}</p>
				</div>
				<div>
					<p className="text-sm font-medium text-gray-500">Diperbarui Pada</p>
					<p className="text-gray-900">{new Date(item.updatedAt).toLocaleString("id-ID")}</p>
				</div>
			</div>

			<section className="space-y-3">
				<div>
					<h2 className="text-lg font-bold text-slate-950">Riwayat Mutasi Stok (Buku Besar)</h2>
					<p className="text-xs text-slate-500">Jejak lengkap penambahan, kerusakan, mutasi keluar, dan pemusnahan barang.</p>
				</div>

				<div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div className="overflow-x-auto" role="region" aria-label="Riwayat mutasi stok" tabIndex={0}>
						<table className="min-w-[50rem] divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									{["Waktu", "Tipe Mutasi", "Jumlah", "Keterangan", "Petugas"].map((header) => (
										<th key={header} className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">
											{header}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{movements.map((m) => (
									<tr key={m.id} className="hover:bg-gray-50">
										<td className="whitespace-nowrap px-5 py-3.5 text-xs text-gray-600">
											{new Date(m.createdAt).toLocaleString("id-ID")}
										</td>
										<td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium">
											<span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-800">
												{enumLabel(m.type)}
											</span>
										</td>
										<td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium text-gray-900">
											{m.quantity} {item.unit}
											{m.baseQuantity !== null && m.baseUnit && m.baseUnit !== item.unit && (
												<span className="ml-1 text-xs text-gray-500">({m.baseQuantity} {m.baseUnit})</span>
											)}
										</td>
										<td className="px-5 py-3.5 text-sm text-gray-600 max-w-xs truncate">
											{m.reason ?? "-"}
										</td>
										<td className="whitespace-nowrap px-5 py-3.5 text-xs text-gray-600">
											{m.createdBy?.name ?? "Sistem"}
										</td>
									</tr>
								))}
								{movements.length === 0 && (
									<tr>
										<td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">
											Belum ada riwayat mutasi untuk barang ini.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<ConfirmDialog
				isOpen={confirmDelete}
				title="Hapus Item Logistik"
				message={`Apakah Anda yakin ingin menghapus item logistik "${item.itemName}"? Tindakan ini tidak dapat dibatalkan.`}
				confirmLabel="Hapus Item"
				variant="danger"
				busy={deleting}
				onConfirm={handleDelete}
				onClose={() => setConfirmDelete(false)}
			/>
		</div>
	);
}
