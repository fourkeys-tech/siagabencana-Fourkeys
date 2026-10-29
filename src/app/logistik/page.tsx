"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField, FormSelect } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useSession } from "@/components/auth/user-provider";

interface LogisticsItem {
	id: string;
	campId: string;
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
	quantityBase: number;
	reservedQuantityBase: number;
	damagedQuantityBase: number;
	minimumQuantityBase: number;
	status: string;
	notes: string | null;
}
interface Camp { id: string; name: string; }
type FormState = { campId: string; itemName: string; quantity: string; unit: string; baseUnit: string; unitDimension: string; conversionFactor: string; minimumQuantity: string; conversionNote: string; notes: string };

const emptyForm: FormState = { campId: "", itemName: "", quantity: "", unit: "", baseUnit: "", unitDimension: "COUNT", conversionFactor: "", minimumQuantity: "", conversionNote: "", notes: "" };
const unitOptions = [{ value: "", label: "Pilih unit" }, { value: "pcs", label: "pcs (buah)" }, { value: "unit", label: "unit (peralatan)" }, { value: "g", label: "g" }, { value: "kg", label: "kg" }, { value: "ml", label: "ml" }, { value: "l", label: "l" }, { value: "dus", label: "dus (isi perlu didefinisikan)" }, { value: "box", label: "box (isi perlu didefinisikan)" }, { value: "paket", label: "paket (isi perlu didefinisikan)" }, { value: "karton", label: "karton (isi perlu didefinisikan)" }];
const baseUnitOptions = [{ value: "", label: "Pilih unit dasar" }, { value: "pcs", label: "pcs" }, { value: "unit", label: "unit" }, { value: "g", label: "g (massa)" }, { value: "ml", label: "ml (volume)" }];

function unitDefaults(unit: string) {
	if (unit === "kg") return { baseUnit: "g", unitDimension: "MASS", conversionFactor: "1000" };
	if (unit === "g") return { baseUnit: "g", unitDimension: "MASS", conversionFactor: "1" };
	if (unit === "l") return { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: "1000" };
	if (unit === "ml") return { baseUnit: "ml", unitDimension: "VOLUME", conversionFactor: "1" };
	if (unit === "unit") return { baseUnit: "unit", unitDimension: "COUNT", conversionFactor: "1" };
	if (unit === "pcs") return { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: "1" };
	return { baseUnit: "pcs", unitDimension: "COUNT", conversionFactor: "" };
}

export default function LogisticsPage() {
	const { user } = useSession();
	const isSuperAdmin = user?.role === "SUPER_ADMIN";

	const [items, setItems] = useState<LogisticsItem[]>([]);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [modalError, setModalError] = useState("");
	const [movementModalError, setMovementModalError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [movementItem, setMovementItem] = useState<LogisticsItem | null>(null);
	const [movementAction, setMovementAction] = useState("RECEIPT");
	const [movementQuantity, setMovementQuantity] = useState("");
	const [movementReason, setMovementReason] = useState("");
	const [formData, setFormData] = useState<FormState>(emptyForm);

	const loadData = useCallback(() => {
		return fetch("/api/logistics")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					if (Array.isArray(data.data)) setItems(data.data);
					else if (data.data?.data) setItems(data.data.data);
				} else {
					setError(data.message ?? "Gagal memuat data logistik");
				}
			})
			.catch(() => setError("Terjadi kesalahan saat memuat data"))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		void loadData();
		fetch("/api/public/camps")
			.then((res) => res.json())
			.then((data) => { if (data.success) setCamps(data.data); })
			.catch(() => undefined);
	}, [loadData]);

	const selectUnit = (unit: string) => setFormData((current) => ({ ...current, unit, ...unitDefaults(unit) }));

	const openCreateModal = () => {
		setModalError("");
		setFormData({
			...emptyForm,
			campId: isSuperAdmin ? "" : (user?.campId ?? ""),
		});
		setShowModal(true);
	};

	const handleCreate = async () => {
		const campIdToUse = isSuperAdmin ? formData.campId : (user?.campId ?? formData.campId);
		if (!campIdToUse) {
			setModalError("Pilih posko terlebih dahulu.");
			return;
		}

		setSubmitting(true);
		setModalError("");
		try {
			const res = await fetch("/api/logistics", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					campId: campIdToUse,
					quantity: Number(formData.quantity),
					minimumQuantity: Number(formData.minimumQuantity || 0),
					conversionFactor: formData.conversionFactor ? Number(formData.conversionFactor) : undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message ?? "Gagal menambahkan item logistik.");
			setShowModal(false);
			setFormData(emptyForm);
			await loadData();
		} catch (createError) {
			setModalError(createError instanceof Error ? createError.message : "Terjadi kesalahan.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleMovement = async () => {
		if (!movementItem) return;
		setSubmitting(true);
		setMovementModalError("");
		try {
			const res = await fetch(`/api/logistics/${movementItem.id}/movements`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: movementAction,
					quantity: Number(movementQuantity),
					reason: movementReason,
				}),
			});
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message ?? "Gagal mencatat mutasi stok.");
			setMovementItem(null);
			setMovementQuantity("");
			setMovementReason("");
			await loadData();
		} catch (movementError) {
			setMovementModalError(movementError instanceof Error ? movementError.message : "Gagal mencatat stok.");
		} finally {
			setSubmitting(false);
		}
	};

	const movementLimit = movementItem
		? movementAction === "RESTORE" || movementAction === "DISPOSE"
			? movementItem.damagedQuantity
			: movementAction === "DAMAGE" || movementAction === "LOSS"
				? Math.max(movementItem.quantity - movementItem.reservedQuantity, 0)
				: undefined
		: undefined;

	return (
		<div className="space-y-6">
			<div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">Inventory control</div>
					<h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Logistik</h1>
					<p className="mt-2 text-sm text-slate-500">Kelola saldo layak pakai melalui pergerakan stok yang terlacak.</p>
				</div>
				<Button onClick={openCreateModal}>+ Tambah item</Button>
			</div>
			{error && <Alert type="error">{error}</Alert>}
			{loading ? (
				<div className="py-12 text-center text-slate-500">Memuat data logistik...</div>
			) : (
				<div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div className="overflow-x-auto" role="region" aria-label="Daftar logistik" tabIndex={0}>
						<table className="min-w-[70rem] divide-y divide-slate-200">
							<thead className="bg-slate-50">
								<tr>
									{["Barang", "Stok layak", "Reserved", "Rusak", "Unit dasar", "Status", "Posko", "Aksi"].map((header) => (
										<th key={header} className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
											{header}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{items.map((item) => (
									<tr key={item.id} className="hover:bg-slate-50">
										<td className="px-5 py-4">
											<p className="text-sm font-semibold text-slate-900">{item.itemName}</p>
											<p className="text-xs text-slate-500">Minimum {item.minimumQuantity} {item.unit}</p>
										</td>
										<td className="px-5 py-4 text-sm font-semibold text-slate-700">
											{item.quantity} {item.unit}
											<p className="text-xs font-normal text-slate-400">tersedia {Math.max(item.quantity - item.reservedQuantity, 0)} {item.unit}</p>
										</td>
										<td className="px-5 py-4 text-sm text-amber-700">{item.reservedQuantity} {item.unit}</td>
										<td className="px-5 py-4 text-sm text-rose-700">{item.damagedQuantity} {item.unit}</td>
										<td className="px-5 py-4 text-sm text-slate-600">
											{item.quantityBase} {item.baseUnit}
											<p className="text-xs text-slate-400">1 {item.unit} = {item.conversionFactor} {item.baseUnit}</p>
											{item.conversionStatus === "NEEDS_REVIEW" && <span className="text-xs font-semibold text-amber-700">Isi kemasan belum diverifikasi</span>}
										</td>
										<td className="px-5 py-4"><Badge label={item.status} /></td>
										<td className="px-5 py-4 text-sm text-slate-600">{item.camp?.name}</td>
										<td className="px-5 py-4">
											<ActionMenu
												label={item.itemName}
												disabled={submitting}
												items={[
													{ label: "Detail", href: `/logistik/${item.id}` },
													{ label: "Edit", href: `/logistik/${item.id}/edit` },
													{
														label: "Stok masuk / pengganti",
														onSelect: () => {
															setMovementItem(item);
															setMovementAction("RECEIPT");
															setMovementModalError("");
														},
													},
													{
														label: "Tandai rusak",
														danger: true,
														onSelect: () => {
															setMovementItem(item);
															setMovementAction("DAMAGE");
															setMovementModalError("");
														},
													},
													{
														label: "Catat hilang",
														onSelect: () => {
															setMovementItem(item);
															setMovementAction("LOSS");
															setMovementModalError("");
														},
													},
													...(item.damagedQuantity > 0
														? [
																{
																	label: "Pulihkan setelah diperbaiki",
																	onSelect: () => {
																		setMovementItem(item);
																		setMovementAction("RESTORE");
																		setMovementModalError("");
																	},
																},
																{
																	label: "Keluarkan dari inventaris",
																	danger: true,
																	onSelect: () => {
																		setMovementItem(item);
																		setMovementAction("DISPOSE");
																		setMovementModalError("");
																	},
																},
															]
														: []),
												]}
											/>
										</td>
									</tr>
								))}
								{items.length === 0 && (
									<tr>
										<td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
											Belum ada item logistik.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<Modal isOpen={showModal} onClose={() => !submitting && setShowModal(false)} title="Tambah item logistik">
				<form onSubmit={(event) => { event.preventDefault(); void handleCreate(); }} className="space-y-3">
					{modalError && <Alert type="error">{modalError}</Alert>}
					{isSuperAdmin ? (
						<FormSelect
							label="Posko"
							value={formData.campId}
							onChange={(value) => setFormData({ ...formData, campId: value })}
							options={[{ value: "", label: "Pilih posko" }, ...camps.map((camp) => ({ value: camp.id, label: camp.name }))]}
							required
							disabled={submitting}
						/>
					) : (
						<div className="space-y-1.5 mb-4">
							<p className="block text-xs font-bold uppercase tracking-wide text-slate-600">Posko</p>
							<div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700">
								{user?.camp?.name ?? "Posko akun Anda"}
							</div>
						</div>
					)}
					<FormField
						label="Nama barang"
						value={formData.itemName}
						onChange={(value) => setFormData({ ...formData, itemName: value })}
						required
						disabled={submitting}
					/>
					<FormField
						label="Stok awal"
						type="number"
						value={formData.quantity}
						onChange={(value) => setFormData({ ...formData, quantity: value })}
						min={0}
						required
						disabled={submitting}
					/>
					<FormField
						label="Batas minimum"
						type="number"
						value={formData.minimumQuantity}
						onChange={(value) => setFormData({ ...formData, minimumQuantity: value })}
						min={0}
						disabled={submitting}
					/>
					<FormSelect
						label="Unit tampilan"
						value={formData.unit}
						onChange={selectUnit}
						options={unitOptions}
						required
						disabled={submitting}
					/>
					<FormSelect
						label="Dimensi"
						value={formData.unitDimension}
						onChange={(value) => setFormData({ ...formData, unitDimension: value })}
						options={[
							{ value: "COUNT", label: "Jumlah (pcs/unit)" },
							{ value: "MASS", label: "Massa (g/kg)" },
							{ value: "VOLUME", label: "Volume (ml/l)" },
						]}
						required
						disabled={submitting}
					/>
					<FormSelect
						label="Unit dasar kanonik"
						value={formData.baseUnit}
						onChange={(value) => setFormData({ ...formData, baseUnit: value })}
						options={baseUnitOptions}
						required
						disabled={submitting}
					/>
					<FormField
						label="Isi per unit tampilan"
						type="number"
						value={formData.conversionFactor}
						onChange={(value) => setFormData({ ...formData, conversionFactor: value })}
						min={1}
						placeholder="Contoh: 24 untuk 1 dus = 24 pcs"
						required={Boolean(formData.unit && !["pcs", "unit", "g", "kg", "ml", "l"].includes(formData.unit))}
						disabled={submitting}
					/>
					<p className="text-xs text-slate-500">
						Unit standar otomatis memakai faktor resmi. Unit dus/box/paket wajib memiliki isi terverifikasi; jangan mengisi angka perkiraan.
					</p>
					<FormField
						label="Catatan definisi konversi"
						value={formData.conversionNote}
						onChange={(value) => setFormData({ ...formData, conversionNote: value })}
						placeholder="Sumber dokumen atau keterangan isi kemasan"
						disabled={submitting}
					/>
					<FormField
						label="Catatan"
						value={formData.notes}
						onChange={(value) => setFormData({ ...formData, notes: value })}
						disabled={submitting}
					/>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
							Batal
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? "Menyimpan..." : "Simpan"}
						</Button>
					</div>
				</form>
			</Modal>

			<Modal
				isOpen={Boolean(movementItem)}
				onClose={() => !submitting && setMovementItem(null)}
				title={
					movementAction === "DAMAGE"
						? "Laporkan barang rusak"
						: movementAction === "LOSS"
							? "Catat kehilangan"
							: movementAction === "RESTORE"
								? "Pulihkan barang rusak"
								: movementAction === "DISPOSE"
									? "Keluarkan barang rusak"
									: "Catat stok masuk / pengganti"
				}
			>
				{movementItem && (
					<form onSubmit={(event) => { event.preventDefault(); void handleMovement(); }} className="space-y-3">
						{movementModalError && <Alert type="error">{movementModalError}</Alert>}
						<p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
							<b>{movementItem.itemName}</b> · tersedia {movementItem.quantity - movementItem.reservedQuantity} {movementItem.unit} · saldo dasar {movementItem.quantityBase - movementItem.reservedQuantityBase} {movementItem.baseUnit}
							{movementAction === "RECEIPT" && movementItem.status === "SPOILED_OR_DAMAGED" ? (
								<span className="mt-1 block text-xs text-blue-700">Stok pengganti akan dibuat sebagai item terpisah.</span>
							) : null}
						</p>
						<FormField
							label="Jumlah"
							type="number"
							value={movementQuantity}
							onChange={setMovementQuantity}
							min={1}
							max={movementLimit}
							required
							disabled={submitting}
						/>
						<FormField
							label="Alasan / sumber"
							value={movementReason}
							onChange={setMovementReason}
							placeholder="Wajib untuk rusak, hilang, atau pemulihan"
							required={movementAction !== "RECEIPT"}
							disabled={submitting}
						/>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="secondary" onClick={() => setMovementItem(null)} disabled={submitting}>
								Batal
							</Button>
							<Button type="submit" disabled={submitting}>
								{submitting ? "Menyimpan..." : "Simpan pergerakan"}
							</Button>
						</div>
					</form>
				)}
			</Modal>
		</div>
	);
}
