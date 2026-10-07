"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, FormSelect } from "@/components/ui/form-field";

interface LogisticsItem {
	id: string;
	itemName: string;
	quantity: number;
	reservedQuantity: number;
	damagedQuantity: number;
	baseUnit: string;
	unitDimension: "COUNT" | "MASS" | "VOLUME";
	conversionFactor: number;
	conversionStatus: "CONFIGURED" | "NEEDS_REVIEW";
	quantityBase: number;
	reservedQuantityBase: number;
	damagedQuantityBase: number;
	unit: string;
	status: string;
	notes: string | null;
}

type FormState = { itemName: string; unit: string; baseUnit: string; unitDimension: "COUNT" | "MASS" | "VOLUME"; conversionFactor: string; conversionStatus: "CONFIGURED" | "NEEDS_REVIEW"; conversionNote: string; notes: string };
const baseUnits = [{ value: "pcs", label: "pcs" }, { value: "unit", label: "unit" }, { value: "g", label: "g (massa)" }, { value: "ml", label: "ml (volume)" }];
const dimensions = [{ value: "COUNT", label: "Jumlah (pcs/unit)" }, { value: "MASS", label: "Massa (g/kg)" }, { value: "VOLUME", label: "Volume (ml/l)" }];
const unitOptions = [
	{ value: "pcs", label: "pcs (buah)" },
	{ value: "unit", label: "unit (peralatan)" },
	{ value: "g", label: "g" },
	{ value: "kg", label: "kg" },
	{ value: "ml", label: "ml" },
	{ value: "l", label: "l" },
	{ value: "dus", label: "dus (isi perlu didefinisikan)" },
	{ value: "box", label: "box (isi perlu didefinisikan)" },
	{ value: "paket", label: "paket (isi perlu didefinisikan)" },
	{ value: "karton", label: "karton (isi perlu didefinisikan)" },
];

export default function LogisticsEditPage() {
	const params = useParams();
	const router = useRouter();
	const id = params.id;
	const [item, setItem] = useState<LogisticsItem | null>(null);
	const [formData, setFormData] = useState<FormState>({ itemName: "", unit: "", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: "1", conversionStatus: "NEEDS_REVIEW", conversionNote: "", notes: "" });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!id || typeof id !== "string") return;
		fetch(`/api/logistics/${id}`).then((res) => res.json()).then((data) => {
			if (!data.success) throw new Error(data.message ?? "Gagal memuat data logistik");
			setItem(data.data);
			setFormData({ itemName: data.data.itemName, unit: data.data.unit, baseUnit: data.data.baseUnit, unitDimension: data.data.unitDimension, conversionFactor: String(data.data.conversionFactor), conversionStatus: data.data.conversionStatus, conversionNote: data.data.conversionNote ?? "", notes: data.data.notes ?? "" });
		}).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan")).finally(() => setLoading(false));
	}, [id]);

	if (loading) return <div className="flex h-64 items-center justify-center text-gray-500">Memuat...</div>;
	if (!item) return <Alert type="error">{error || "Item logistik tidak ditemukan."}</Alert>;
	const hasBalance = item.quantity > 0 || item.reservedQuantity > 0 || item.damagedQuantity > 0 || item.quantityBase > 0 || item.reservedQuantityBase > 0 || item.damagedQuantityBase > 0;
	const update = (key: keyof FormState, value: string) => setFormData((current) => ({ ...current, [key]: value }));
	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setSubmitting(true);
		setError("");
		try {
			const body: Record<string, unknown> = { itemName: formData.itemName, notes: formData.notes || null };
			if (!hasBalance) Object.assign(body, { unit: formData.unit, baseUnit: formData.baseUnit, unitDimension: formData.unitDimension, conversionFactor: Number(formData.conversionFactor), conversionStatus: formData.conversionStatus, conversionNote: formData.conversionNote || null });
			const res = await fetch(`/api/logistics/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message);
			router.push(`/logistik/${id}`);
			router.refresh();
		} catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Gagal memperbarui data logistik"); } finally { setSubmitting(false); }
	};

	return <div className="w-full max-w-3xl min-w-0 space-y-6"><h1 className="text-2xl font-bold text-gray-900">Edit Logistik: {item.itemName}</h1>{error && <Alert type="error">{error}</Alert>}<form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><FormField label="Nama Barang" value={formData.itemName} onChange={(value) => update("itemName", value)} required /><div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Saldo hanya berubah melalui inventory movement.<div className="mt-2 font-semibold">Layak: {item.quantity} {item.unit} · tersedia {Math.max(item.quantity - item.reservedQuantity, 0)} {item.unit} · rusak: {item.damagedQuantity} {item.unit}</div><div className="mt-1">Saldo dasar: {item.quantityBase} {item.baseUnit} · 1 {item.unit} = {item.conversionFactor} {item.baseUnit}</div></div><FormSelect label="Unit tampilan" value={formData.unit} onChange={(value) => update("unit", value)} options={unitOptions} disabled={hasBalance} required /><div className="grid gap-4 sm:grid-cols-2"><FormSelect label="Dimensi" value={formData.unitDimension} onChange={(value) => update("unitDimension", value as FormState["unitDimension"])} options={dimensions} required /><FormSelect label="Unit dasar kanonik" value={formData.baseUnit} onChange={(value) => update("baseUnit", value)} options={baseUnits} required /></div><FormField label="Faktor konversi" type="number" value={formData.conversionFactor} onChange={(value) => update("conversionFactor", value)} min={1} readOnly={hasBalance} required /><FormSelect label="Status definisi" value={formData.conversionStatus} onChange={(value) => update("conversionStatus", value as FormState["conversionStatus"])} options={[{ value: "CONFIGURED", label: "Terverifikasi" }, { value: "NEEDS_REVIEW", label: "Perlu verifikasi" }]} required /><FormField label="Catatan definisi konversi" value={formData.conversionNote} onChange={(value) => update("conversionNote", value)} /><FormField label="Catatan" value={formData.notes} onChange={(value) => update("notes", value)} />{hasBalance && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Definisi unit dikunci karena saldo masih ada. Kosongkan saldo melalui alur inventory yang tercatat sebelum mengubah konversi.</p>}<div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end sm:gap-3"><Link href={`/logistik/${item.id}`}><Button type="button" variant="secondary">Batal</Button></Link><Button type="submit" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Perubahan"}</Button></div></form></div>;
}
