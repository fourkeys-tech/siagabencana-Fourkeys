"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export default function LogisticsDetailPage() {
	const params = useParams();
	const router = useRouter();
	const id = params.id;
	const [item, setItem] = useState<LogisticsItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!id || typeof id !== "string") return;
		fetch(`/api/logistics/${id}`).then((res) => res.json()).then((data) => { if (data.success) setItem(data.data); else setError(data.message ?? "Gagal memuat data logistik"); }).catch(() => setError("Terjadi kesalahan")).finally(() => setLoading(false));
	}, [id]);

	const handleDelete = async () => {
		if (!item || !confirm(`Hapus item logistik "${item.itemName}"?`)) return;
		try {
			const res = await fetch(`/api/logistics/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message);
			router.push("/logistik");
			router.refresh();
		} catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Terjadi kesalahan"); }
	};

	if (loading) return <div className="flex h-64 items-center justify-center text-gray-500">Memuat...</div>;
	if (error) return <Alert type="error">{error}</Alert>;
	if (!item) return <Alert type="info">Item logistik tidak ditemukan.</Alert>;

	return <div className="space-y-6"><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-2xl font-bold text-gray-900">Detail Logistik: {item.itemName}</h1><div className="flex gap-2"><Link href={`/logistik/${item.id}/edit`}><Button variant="secondary">Edit</Button></Link><Button variant="danger" onClick={() => void handleDelete()}>Hapus</Button></div></div><div className="grid gap-4 rounded-lg border bg-white p-6 shadow-sm sm:grid-cols-2"><div><p className="text-sm font-medium text-gray-500">Nama Barang</p><p className="text-gray-900">{item.itemName}</p></div><div><p className="text-sm font-medium text-gray-500">Posko</p><p className="text-gray-900">{item.camp?.name}</p></div><div><p className="text-sm font-medium text-gray-500">Stok layak pakai</p><p className="text-gray-900">{item.quantity} {item.unit}</p><p className="text-xs text-gray-500">tersedia {Math.max(item.quantity - item.reservedQuantity, 0)} {item.unit}</p></div><div><p className="text-sm font-medium text-gray-500">Saldo dasar kanonik</p><p className="text-gray-900">{item.quantityBase} {item.baseUnit}</p><p className="text-xs text-gray-500">tersedia {Math.max(item.quantityBase - item.reservedQuantityBase, 0)} {item.baseUnit}</p></div><div><p className="text-sm font-medium text-gray-500">Reserved</p><p className="text-gray-900">{item.reservedQuantity} {item.unit} · {item.reservedQuantityBase} {item.baseUnit}</p></div><div><p className="text-sm font-medium text-gray-500">Rusak</p><p className="text-gray-900">{item.damagedQuantity} {item.unit} · {item.damagedQuantityBase} {item.baseUnit}</p></div><div><p className="text-sm font-medium text-gray-500">Definisi unit</p><p className="text-gray-900">1 {item.unit} = {item.conversionFactor} {item.baseUnit}</p><p className="text-xs text-gray-500">Dimensi: {item.unitDimension}</p>{item.conversionStatus === "NEEDS_REVIEW" && <p className="text-xs font-semibold text-amber-700">Perlu verifikasi isi kemasan</p>}</div><div><p className="text-sm font-medium text-gray-500">Status</p><Badge label={item.status} /></div><div className="sm:col-span-2"><p className="text-sm font-medium text-gray-500">Catatan definisi</p><p className="text-gray-900">{item.conversionNote ?? "-"}</p></div><div className="sm:col-span-2"><p className="text-sm font-medium text-gray-500">Catatan</p><p className="text-gray-900">{item.notes ?? "-"}</p></div><div><p className="text-sm font-medium text-gray-500">Dibuat Pada</p><p className="text-gray-900">{new Date(item.createdAt).toLocaleString("id-ID")}</p></div><div><p className="text-sm font-medium text-gray-500">Diperbarui Pada</p><p className="text-gray-900">{new Date(item.updatedAt).toLocaleString("id-ID")}</p></div></div></div>;
}
