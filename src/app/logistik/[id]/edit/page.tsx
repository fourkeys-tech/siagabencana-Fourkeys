"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, FormSelect } from "@/components/ui/form-field";
import { enumLabel } from "@/lib/labels";
import { baseUnitsForDimension, DIMENSION_OPTIONS, isStandardUnit, isUnitDimension, UNIT_OPTIONS, unitDefaults, type UnitConversionStatus, type UnitDimension } from "@/lib/unit-conversion";

interface LogisticsItem {
	id: string;
	itemName: string;
	quantity: number;
	reservedQuantity: number;
	damagedQuantity: number;
	minimumQuantity: number;
	unit: string;
	baseUnit: string;
	unitDimension: UnitDimension;
	conversionFactor: number;
	conversionStatus: UnitConversionStatus;
	conversionNote: string | null;
	quantityBase: number;
	reservedQuantityBase: number;
	damagedQuantityBase: number;
	status: string;
	notes: string | null;
}

type FormState = {
	itemName: string;
	minimumQuantity: string;
	unit: string;
	baseUnit: string;
	unitDimension: string;
	conversionFactor: string;
	conversionNote: string;
	notes: string;
};

const emptyForm: FormState = { itemName: "", minimumQuantity: "0", unit: "", baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: "", conversionNote: "", notes: "" };
const dimensionSelectOptions = [...DIMENSION_OPTIONS];

function baseUnitSelectOptions(dimension: string) {
	return (isUnitDimension(dimension) ? baseUnitsForDimension(dimension) : []).map((unit) => ({ value: unit, label: unit }));
}

// Barang yang belum diverifikasi disimpan sebagai identitas (1 dus = 1 dus);
// form memulai dari default kemasan (pcs, faktor kosong) agar unit dasar yang sah bisa dipilih.
function formFromItem(item: LogisticsItem): FormState {
	const unitFields = item.conversionStatus === "CONFIGURED"
		? { baseUnit: item.baseUnit, unitDimension: item.unitDimension, conversionFactor: String(item.conversionFactor) }
		: unitDefaults(item.unit);
	return {
		itemName: item.itemName,
		minimumQuantity: String(item.minimumQuantity),
		unit: item.unit,
		...unitFields,
		conversionNote: item.conversionNote ?? "",
		notes: item.notes ?? "",
	};
}

export default function LogisticsEditPage() {
	const params = useParams();
	const router = useRouter();
	const id = params.id;
	const [item, setItem] = useState<LogisticsItem | null>(null);
	const [formData, setFormData] = useState<FormState>(emptyForm);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!id || typeof id !== "string") return;
		fetch(`/api/logistics/${id}`)
			.then((res) => res.json())
			.then((data) => {
				if (!data.success) throw new Error(data.message ?? "Gagal memuat data logistik");
				setItem(data.data);
				setFormData(formFromItem(data.data));
			})
			.catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan"))
			.finally(() => setLoading(false));
	}, [id]);

	if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Memuat...</div>;
	if (!item) return <Alert type="error">{error || "Item logistik tidak ditemukan."}</Alert>;

	const hasBalance = item.quantity > 0 || item.reservedQuantity > 0 || item.damagedQuantity > 0
		|| item.quantityBase > 0 || item.reservedQuantityBase > 0 || item.damagedQuantityBase > 0;
	const needsReview = item.conversionStatus === "NEEDS_REVIEW";
	// Saat saldo ada, definisi unit terkunci; satu-satunya perubahan yang diizinkan adalah
	// verifikasi isi kemasan untuk barang NEEDS_REVIEW (unit tetap, saldo dasar dihitung ulang).
	const canVerify = hasBalance && needsReview;
	const unitEditable = !hasBalance;
	const standardUnitSelected = isStandardUnit(formData.unit);
	const factorFilled = formData.conversionFactor.trim() !== "";

	const update = (key: keyof FormState, value: string) => setFormData((current) => ({ ...current, [key]: value }));
	const selectUnit = (unit: string) => setFormData((current) => ({ ...current, unit, ...unitDefaults(unit) }));
	const selectDimension = (unitDimension: string) => setFormData((current) => ({
		...current,
		unitDimension,
		baseUnit: isUnitDimension(unitDimension) ? (baseUnitsForDimension(unitDimension)[0] ?? "") : "",
	}));

	const unitPayload = (): Record<string, unknown> => {
		if (unitEditable) {
			if (standardUnitSelected) return { unit: formData.unit };
			return {
				unit: formData.unit,
				baseUnit: formData.baseUnit,
				unitDimension: formData.unitDimension,
				// null = isi kemasan dikosongkan → dicatat per kemasan (perlu verifikasi).
				conversionFactor: factorFilled ? Number(formData.conversionFactor) : null,
			};
		}
		if (canVerify && factorFilled) {
			return { unit: item.unit, baseUnit: formData.baseUnit, unitDimension: formData.unitDimension, conversionFactor: Number(formData.conversionFactor) };
		}
		return {};
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setSubmitting(true);
		setError("");
		try {
			const body: Record<string, unknown> = {
				itemName: formData.itemName,
				minimumQuantity: Number(formData.minimumQuantity || 0),
				conversionNote: formData.conversionNote,
				notes: formData.notes || null,
				...unitPayload(),
			};
			const res = await fetch(`/api/logistics/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message ?? "Gagal memperbarui data logistik");
			router.push(`/logistik/${item.id}`);
			router.refresh();
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Gagal memperbarui data logistik");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="w-full max-w-3xl min-w-0 space-y-6">
			<h1 className="text-2xl font-bold text-slate-900">Edit Logistik: {item.itemName}</h1>
			{error && <Alert type="error">{error}</Alert>}
			<form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<FormField label="Nama Barang" value={formData.itemName} onChange={(value) => update("itemName", value)} required disabled={submitting} />
				<FormField
					label={`Batas minimum (${item.unit})`}
					type="number"
					value={formData.minimumQuantity}
					onChange={(value) => update("minimumQuantity", value)}
					min={0}
					step={1}
					disabled={submitting}
				/>

				<div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
					Saldo hanya berubah melalui pergerakan stok.
					<div className="mt-2 font-semibold">
						Layak: {item.quantity} {item.unit} · tersedia {Math.max(item.quantity - item.reservedQuantity, 0)} {item.unit} · rusak: {item.damagedQuantity} {item.unit}
					</div>
					{item.unit !== item.baseUnit && (
						<div className="mt-1">Saldo dasar: {item.quantityBase} {item.baseUnit} · 1 {item.unit} = {item.conversionFactor} {item.baseUnit}</div>
					)}
					<div className="mt-1">Status definisi: {enumLabel(item.conversionStatus)}</div>
				</div>

				{unitEditable ? (
					<section className="space-y-2">
						<FormSelect label="Unit tampilan" value={formData.unit} onChange={selectUnit} options={[...UNIT_OPTIONS]} required disabled={submitting} />
						<div className="grid gap-4 sm:grid-cols-2">
							<FormSelect label="Dimensi" value={formData.unitDimension} onChange={selectDimension} options={dimensionSelectOptions} required disabled={submitting || standardUnitSelected} />
							<FormSelect label="Unit dasar kanonik" value={formData.baseUnit} onChange={(value) => update("baseUnit", value)} options={baseUnitSelectOptions(formData.unitDimension)} required disabled={submitting || standardUnitSelected} />
						</div>
						<FormField
							label={standardUnitSelected ? "Isi per unit tampilan (resmi)" : "Isi per kemasan (opsional)"}
							type="number"
							value={formData.conversionFactor}
							onChange={(value) => update("conversionFactor", value)}
							min={standardUnitSelected ? 1 : 2}
							step={1}
							placeholder={standardUnitSelected ? undefined : `Contoh: 24 untuk 1 ${formData.unit} = 24 ${formData.baseUnit || "pcs"}`}
							readOnly={standardUnitSelected}
							disabled={submitting}
						/>
						<p className="text-xs text-slate-500">
							{standardUnitSelected
								? `Unit standar memakai definisi resmi (1 ${formData.unit} = ${formData.conversionFactor} ${formData.baseUnit}) dan tidak dapat diubah.`
								: `Isi hanya bila isi kemasan sudah pasti. Bila dikosongkan, stok dicatat per ${formData.unit} tanpa konversi ke unit lain.`}
						</p>
					</section>
				) : (
					<p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
						Unit ({item.unit}) dan definisinya dikunci karena saldo masih ada.
						{canVerify ? " Isi kemasan masih dapat diverifikasi di bawah." : " Kosongkan saldo melalui pergerakan stok sebelum mengubah definisi unit."}
					</p>
				)}

				{canVerify && (
					<section className="space-y-2 rounded-xl border border-amber-200 p-4">
						<h2 className="text-sm font-bold text-slate-900">Verifikasi isi kemasan</h2>
						<p className="text-xs text-slate-600">
							Isi bila isi 1 {item.unit} sudah dipastikan (mis. dari label atau dokumen). Saldo dasar dihitung ulang dari {item.quantity} {item.unit} layak dan {item.damagedQuantity} {item.unit} rusak. Tidak dapat dilakukan saat stok dicadangkan atau masih ada permintaan/distribusi berjalan.
						</p>
						<div className="grid gap-4 sm:grid-cols-2">
							<FormSelect label="Dimensi" value={formData.unitDimension} onChange={selectDimension} options={dimensionSelectOptions} required disabled={submitting} />
							<FormSelect label="Unit dasar kanonik" value={formData.baseUnit} onChange={(value) => update("baseUnit", value)} options={baseUnitSelectOptions(formData.unitDimension)} required disabled={submitting} />
						</div>
						<FormField
							label={`Isi per ${item.unit}`}
							type="number"
							value={formData.conversionFactor}
							onChange={(value) => update("conversionFactor", value)}
							min={2}
							step={1}
							placeholder="Kosongkan bila belum pasti"
							disabled={submitting}
						/>
						{factorFilled && (
							<p className="text-xs font-semibold text-amber-800">
								Setelah disimpan: 1 {item.unit} = {formData.conversionFactor} {formData.baseUnit} (perubahan dicatat di log audit).
							</p>
						)}
					</section>
				)}

				<FormField label="Catatan definisi konversi" value={formData.conversionNote} onChange={(value) => update("conversionNote", value)} placeholder="Sumber dokumen atau keterangan isi kemasan" disabled={submitting} />
				<FormField label="Catatan" value={formData.notes} onChange={(value) => update("notes", value)} disabled={submitting} />

				<div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end sm:gap-3">
					<Button type="button" variant="secondary" onClick={() => router.push(`/logistik/${item.id}`)} disabled={submitting}>Batal</Button>
					<Button type="submit" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Perubahan"}</Button>
				</div>
			</form>
		</div>
	);
}
