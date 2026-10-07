"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useSession } from "@/components/auth/user-provider";

 type Camp = { id: string; name: string; status: string };
 type Stock = {
	id: string;
	campId: string;
	itemName: string;
	quantity: number;
	reservedQuantity: number;
	damagedQuantity: number;
	unit: string;
	baseUnit: string;
	unitDimension: "COUNT" | "MASS" | "VOLUME";
	conversionFactor: number;
	conversionStatus: "CONFIGURED" | "NEEDS_REVIEW";
	quantityBase: number;
	reservedQuantityBase: number;
	damagedQuantityBase: number;
	status: string;
 };
 type Request = {
	id: string;
	sourceCampId: string;
	destinationCampId: string;
	itemName: string;
	quantity: number;
	unit: string;
	requestedQuantity: number | null;
	requestedUnit: string | null;
	baseQuantity: number | null;
	baseUnit: string | null;
	conversionStatus: "CONFIGURED" | "NEEDS_REVIEW" | null;
	notes: string | null;
	rejectionReason: string | null;
	status: string;
	sourceCamp: { id: string; name: string };
	destinationCamp: { id: string; name: string };
	createdBy: { id: string; name: string };
	distribution: { id: string; status: string } | null;
 };
 type Distribution = {
	id: string;
	itemName: string;
	quantity: number;
	unit: string;
	requestedQuantity: number | null;
	requestedUnit: string | null;
	baseQuantity: number | null;
	baseUnit: string | null;
	conversionStatus: "CONFIGURED" | "NEEDS_REVIEW" | null;
	status: string;
	shippedAt: string | null;
	receivedAt: string | null;
	receiptProofAvailable: boolean;
	receiptProofMimeType?: string | null;
	sourceCamp: { id: string; name: string };
	destinationCamp: { id: string; name: string };
 };

type FormState = {
	sourceCampId: string;
	destinationCampId: string;
	sourceItemId: string;
	quantity: string;
	requestedUnit: string;
	notes: string;
};

const initialForm: FormState = { sourceCampId: "", destinationCampId: "", sourceItemId: "", quantity: "", requestedUnit: "", notes: "" };

function dateLabel(value: string | null) {
	return value ? new Date(value).toLocaleString("id-ID") : "-";
}

function availableQuantity(stock: Stock) {
	return Math.max(stock.quantity - stock.reservedQuantity, 0);
}

function availableBaseQuantity(stock: Stock) {
	return Math.max(stock.quantityBase - stock.reservedQuantityBase, 0);
}

function standardUnitFactor(unit: string) {
	if (unit === "kg" || unit === "l") return 1000;
	return ["g", "ml", "pcs", "unit"].includes(unit) ? 1 : null;
}

function greatestCommonDivisor(first: number, second: number) {
	let a = Math.abs(first);
	let b = Math.abs(second);
	while (b !== 0) {
		const remainder = a % b;
		a = b;
		b = remainder;
	}
	return a;
}

function requestedQuantityStep(stock: Stock | undefined, requestedUnit: string) {
	if (!stock || !requestedUnit || requestedUnit === stock.unit) return 1;
	const requestedFactor = requestedUnit === stock.baseUnit ? 1 : standardUnitFactor(requestedUnit);
	if (!requestedFactor || stock.conversionFactor <= 0) return 1;
	return stock.conversionFactor / greatestCommonDivisor(stock.conversionFactor, requestedFactor);
}

function unitOptions(stock: Stock | undefined) {
	if (!stock) return [];
	const options = [stock.unit];
	if (stock.conversionStatus === "CONFIGURED") {
		if (stock.baseUnit !== stock.unit) options.push(stock.baseUnit);
		if (stock.unitDimension === "MASS" && !options.includes("kg")) options.push("kg");
		if (stock.unitDimension === "MASS" && !options.includes("g")) options.push("g");
		if (stock.unitDimension === "VOLUME" && !options.includes("l")) options.push("l");
		if (stock.unitDimension === "VOLUME" && !options.includes("ml")) options.push("ml");
	}
	return options;
}

function maxRequestedQuantity(stock: Stock | undefined, requestedUnit: string) {
	if (!stock) return 0;
	if (!requestedUnit || requestedUnit === stock.unit) return availableQuantity(stock);
	const factor = requestedUnit === stock.baseUnit ? 1 : standardUnitFactor(requestedUnit);
	return factor && stock.conversionStatus === "CONFIGURED" ? Math.floor(availableBaseQuantity(stock) / factor) : 0;
}

function conversionPreview(stock: Stock | undefined, quantity: string, requestedUnit: string) {
	const amount = Number(quantity);
	if (!stock || !requestedUnit || !Number.isSafeInteger(amount) || amount <= 0) return "";
	if (requestedUnit === stock.unit) return `${amount} ${requestedUnit} = ${amount * stock.conversionFactor} ${stock.baseUnit}`;
	const factor = requestedUnit === stock.baseUnit ? 1 : standardUnitFactor(requestedUnit);
	if (factor) return `${amount} ${requestedUnit} = ${amount * factor} ${stock.baseUnit}`;
	return "";
}

function quantityLabel(quantity: number, unit: string, baseQuantity: number | null, baseUnit: string | null) {
	const base = baseQuantity && baseUnit ? ` · ${baseQuantity} ${baseUnit}` : "";
	return `${quantity} ${unit}${base}`;
}

export default function DistributionPage() {
	const { user, loading: userLoading } = useSession();
	const [camps, setCamps] = useState<Camp[]>([]);
	const [stocks, setStocks] = useState<Stock[]>([]);
	const [requests, setRequests] = useState<Request[]>([]);
	const [distributions, setDistributions] = useState<Distribution[]>([]);
	const [form, setForm] = useState(initialForm);
	const [approval, setApproval] = useState<Request | null>(null);
	const [receiptDistribution, setReceiptDistribution] = useState<Distribution | null>(null);
	const [receiptProof, setReceiptProof] = useState<File | null>(null);
	const [approvalStockId, setApprovalStockId] = useState("");
	const [approvalQuantity, setApprovalQuantity] = useState("");
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const [campRes, distributionRes] = await Promise.all([
				fetch("/api/public/camps", { cache: "no-store" }),
				fetch("/api/distribution", { cache: "no-store" }),
			]);
			const [campData, distributionData] = await Promise.all([campRes.json(), distributionRes.json()]);
			if (!distributionRes.ok || !distributionData.success) throw new Error(distributionData.message);
			setCamps(campData.success ? campData.data : []);
			setStocks(distributionData.data.sourceStocks ?? []);
			setRequests(distributionData.data.requests ?? []);
			setDistributions(distributionData.data.distributions ?? []);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Gagal memuat distribusi.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (userLoading || !user) return;
		const timer = window.setTimeout(() => void loadData(), 0);
		return () => window.clearTimeout(timer);
	}, [loadData, user, userLoading]);

	const sourceOptions = useMemo(() => camps.filter((camp) => camp.status === "ACTIVE" && camp.id !== (user?.role === "SUPER_ADMIN" ? form.destinationCampId : user?.campId)).map((camp) => ({ value: camp.id, label: camp.name })), [camps, form.destinationCampId, user?.campId, user?.role]);
	const destinationOptions = useMemo(() => camps.filter((camp) => camp.status === "ACTIVE" && camp.id !== form.sourceCampId).map((camp) => ({ value: camp.id, label: camp.name })), [camps, form.sourceCampId]);
	const sourceStocks = useMemo(() => stocks.filter((stock) => stock.campId === form.sourceCampId && stock.status !== "SPOILED_OR_DAMAGED" && stock.damagedQuantity === 0 && stock.damagedQuantityBase === 0 && availableBaseQuantity(stock) > 0), [form.sourceCampId, stocks]);
	const selectedStock = sourceStocks.find((stock) => stock.id === form.sourceItemId);
	const selectedMax = maxRequestedQuantity(selectedStock, form.requestedUnit);
	const preview = conversionPreview(selectedStock, form.quantity, form.requestedUnit);
	const approvalStocks = useMemo(() => {
		if (!approval) return [];
		return stocks.filter((stock) => stock.campId === approval.sourceCampId && stock.itemName.toLowerCase() === approval.itemName.toLowerCase() && stock.unit.toLowerCase() === approval.unit.toLowerCase() && stock.status !== "SPOILED_OR_DAMAGED" && stock.damagedQuantity === 0 && stock.damagedQuantityBase === 0 && availableBaseQuantity(stock) > 0);
	}, [approval, stocks]);
	const approvalStock = approvalStocks.find((stock) => stock.id === approvalStockId);

	const updateForm = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
	const selectSourceCamp = (value: string) => setForm((current) => ({ ...current, sourceCampId: value, destinationCampId: current.destinationCampId === value ? "" : current.destinationCampId, sourceItemId: "", quantity: "", requestedUnit: "" }));
	const selectSourceItem = (value: string) => {
		const stock = sourceStocks.find((item) => item.id === value);
		setForm((current) => ({ ...current, sourceItemId: value, quantity: "", requestedUnit: stock?.unit ?? "" }));
	};

	const submitRequest = async () => {
		const quantity = Number(form.quantity);
		if (!form.sourceItemId || !selectedStock || !form.requestedUnit || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity % requestedQuantityStep(selectedStock, form.requestedUnit) !== 0 || quantity > selectedMax) {
			setError("Pilih stok, unit, dan jumlah yang tidak melebihi saldo tersedia.");
			return;
		}
		setSubmitting(true);
		setError("");
		setMessage("");
		try {
			const res = await fetch("/api/distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceCampId: form.sourceCampId, destinationCampId: form.destinationCampId, sourceItemId: form.sourceItemId, requestedQuantity: quantity, requestedUnit: form.requestedUnit, notes: form.notes }) });
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message);
			setForm(initialForm);
			setMessage(data.message);
			await loadData();
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Gagal membuat permintaan.");
		} finally {
			setSubmitting(false);
		}
	};

	const updateRequest = async (id: string, body: Record<string, unknown>) => {
		setSubmitting(true);
		setError("");
		setMessage("");
		try {
			const res = await fetch(`/api/distribution/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message);
			setMessage(data.message);
			setApproval(null);
			await loadData();
		} catch (actionError) {
			setError(actionError instanceof Error ? actionError.message : "Gagal memperbarui distribusi.");
		} finally {
			setSubmitting(false);
		}
	};

	const submitReceive = async () => {
		if (!receiptDistribution || !receiptProof) {
			setError("Pilih foto bukti penerimaan terlebih dahulu.");
			return;
		}
		setSubmitting(true);
		setError("");
		setMessage("");
		try {
			const payload = new FormData();
			payload.append("action", "RECEIVE");
			payload.append("proof", receiptProof);
			const res = await fetch(`/api/distribution/${receiptDistribution.id}`, { method: "PUT", body: payload });
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message);
			setReceiptDistribution(null);
			setReceiptProof(null);
			setMessage(data.message);
			await loadData();
		} catch (receiveError) {
			setError(receiveError instanceof Error ? receiveError.message : "Gagal mencatat penerimaan.");
		} finally {
			setSubmitting(false);
		}
	};

	const canCreate = user?.role === "SUPER_ADMIN" || (user?.role === "MANAGER" && Boolean(user.campId)) || (user?.division === "LOGISTICS" && Boolean(user.campId));
	const destinationCamp = user?.role === "SUPER_ADMIN" ? form.destinationCampId : user?.campId ?? "";

	if (userLoading || loading) return <div className="flex h-64 items-center justify-center text-gray-500">Memuat...</div>;

	return (
		<div className="min-w-0 space-y-6">
			<div><h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">Distribusi Logistik</h1><p className="mt-1 text-sm text-gray-500">Kelola permintaan, pengiriman, dan penerimaan logistik antar posko.</p></div>
			{error && <Alert type="error">{error}</Alert>}
			{message && <Alert type="success">{message}</Alert>}
			{!canCreate && <Alert type="warning">Fitur distribusi hanya tersedia untuk pengguna divisi logistik.</Alert>}

			{canCreate && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
				<h2 className="mb-4 text-lg font-semibold">Buat Permintaan Logistik</h2>
				<div className="grid gap-4 md:grid-cols-2">
					<SearchableSelect label="Posko Asal" value={form.sourceCampId} onChange={selectSourceCamp} options={sourceOptions} placeholder="Pilih posko asal" emptyMessage="Tidak ada posko aktif yang tersedia." />
					{user?.role === "SUPER_ADMIN" ? <SearchableSelect label="Posko Tujuan" value={form.destinationCampId} onChange={(value) => updateForm("destinationCampId", value)} options={destinationOptions} placeholder="Pilih posko tujuan" emptyMessage="Tidak ada posko tujuan lain." /> : <div className="space-y-1.5"><p className="block text-sm font-medium text-slate-700">Posko Tujuan</p><div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700">{user?.camp?.name ?? "Posko akun belum tersedia"}</div></div>}
					<SearchableSelect label="Barang dari stok sumber" value={form.sourceItemId} onChange={selectSourceItem} options={sourceStocks.map((stock) => ({ value: stock.id, label: stock.itemName, meta: `Tersedia ${availableQuantity(stock)} ${stock.unit} · ${availableBaseQuantity(stock)} ${stock.baseUnit}` }))} placeholder={form.sourceCampId ? "Pilih barang tersedia" : "Pilih posko asal dahulu"} emptyMessage="Posko ini tidak memiliki stok layak pakai yang tersedia." disabled={!form.sourceCampId} />
					<FormField label="Jumlah permintaan" type="number" value={form.quantity} onChange={(value) => updateForm("quantity", value)} min={requestedQuantityStep(selectedStock, form.requestedUnit)} step={requestedQuantityStep(selectedStock, form.requestedUnit)} max={selectedMax || undefined} required />
					<div className="space-y-1.5"><label className="block text-sm font-medium text-slate-700" htmlFor="distribution-unit">Unit permintaan</label><select id="distribution-unit" value={form.requestedUnit} onChange={(event) => updateForm("requestedUnit", event.target.value)} disabled={!selectedStock} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"><option value="">Pilih unit</option>{unitOptions(selectedStock).map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select><p className="text-xs text-slate-500">Maksimal: {selectedStock && form.requestedUnit ? `${selectedMax} ${form.requestedUnit}` : "pilih barang"}</p></div>
					<div className="md:col-span-2">{preview && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">Perhitungan tersinkron: {preview}</p>}{selectedStock?.conversionStatus === "NEEDS_REVIEW" && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Isi kemasan belum terverifikasi. Permintaan hanya boleh memakai unit stok: {selectedStock.unit}.</p>}</div>
					<div className="md:col-span-2"><FormField label="Catatan" value={form.notes} onChange={(value) => updateForm("notes", value)} /></div>
				</div>
				<div className="flex justify-end"><Button onClick={() => void submitRequest()} disabled={submitting || !destinationCamp || !form.sourceCampId || !form.sourceItemId || !form.quantity || !form.requestedUnit || Boolean(selectedStock && Number(form.quantity) > selectedMax)}>{submitting ? "Menyimpan..." : "Buat Permintaan"}</Button></div>
			</div>}

			<div className="rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Permintaan Logistik</h2></div><div className="min-w-0 overflow-x-auto" role="region" aria-label="Data permintaan distribusi" tabIndex={0}><table className="min-w-[52rem] divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{["Barang", "Rute", "Jumlah", "Status", "Aksi"].map((header) => <th key={header} className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{requests.map((item) => { const canReview = user?.role === "SUPER_ADMIN"; return <tr key={item.id}><td className="px-5 py-4 text-sm"><p className="font-medium text-gray-900">{item.itemName}</p><p className="text-gray-500">{item.notes || "Tanpa catatan"}</p></td><td className="px-5 py-4 text-sm text-gray-600">{item.sourceCamp.name} → {item.destinationCamp.name}</td><td className="px-5 py-4 text-sm text-gray-600">{item.requestedQuantity && item.requestedUnit ? `${item.requestedQuantity} ${item.requestedUnit}` : `${item.quantity} ${item.unit}`}<span className="block text-xs text-slate-400">{item.baseQuantity && item.baseUnit ? `Saldo dasar: ${item.baseQuantity} ${item.baseUnit}` : ""}</span></td><td className="px-5 py-4"><Badge label={item.status} />{item.rejectionReason && <p className="mt-1 max-w-48 text-xs text-red-600">{item.rejectionReason}</p>}</td><td className="px-5 py-4">{item.status === "PENDING" && canReview ? <ActionMenu label={`permintaan ${item.itemName}`} items={[{ label: "Setujui & reservasi", onSelect: () => { setApproval(item); setApprovalQuantity(String(item.quantity)); setApprovalStockId(""); } }, { label: "Tolak", danger: true, onSelect: () => { const reason = window.prompt("Alasan penolakan:"); if (reason) void updateRequest(item.id, { action: "REJECT", rejectionReason: reason }); } }]} /> : item.distribution ? <span className="text-xs text-gray-500">Stok diproses</span> : <span className="text-xs text-gray-400">-</span>}</td></tr>; })}{requests.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">Belum ada permintaan distribusi.</td></tr>}</tbody></table></div></div>

			<div className="rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Riwayat Distribusi</h2></div><div className="min-w-0 overflow-x-auto" role="region" aria-label="Riwayat distribusi" tabIndex={0}><table className="min-w-[52rem] divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{["Barang", "Rute", "Jumlah", "Status", "Waktu", "Aksi"].map((header) => <th key={header} className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{distributions.map((item) => { const canShip = user?.role === "SUPER_ADMIN" || (user?.role === "MANAGER" && user.campId === item.sourceCamp.id) || (user?.division === "LOGISTICS" && user.campId === item.sourceCamp.id); const canReceive = user?.role === "SUPER_ADMIN" || (user?.role === "MANAGER" && user.campId === item.destinationCamp.id) || (user?.division === "LOGISTICS" && user.campId === item.destinationCamp.id); const actions: ActionMenuItem[] = []; if (item.status === "RESERVED" && canShip) actions.push({ label: "Kirim", onSelect: () => void updateRequest(item.id, { action: "SHIP" }) }); if (item.status === "SHIPPED" && canReceive) actions.push({ label: "Terima dengan bukti", onSelect: () => { setReceiptDistribution(item); setReceiptProof(null); setError(""); } }); if (item.status === "RESERVED" && canShip) actions.push({ label: "Batalkan", danger: true, onSelect: () => void updateRequest(item.id, { action: "CANCEL" }) }); return <tr key={item.id}><td className="px-5 py-4 text-sm font-medium text-gray-900">{item.itemName}</td><td className="px-5 py-4 text-sm text-gray-600">{item.sourceCamp.name} → {item.destinationCamp.name}</td><td className="px-5 py-4 text-sm text-gray-600">{item.requestedQuantity && item.requestedUnit ? `${item.requestedQuantity} ${item.requestedUnit}` : `${item.quantity} ${item.unit}`}<span className="block text-xs text-slate-400">{item.baseQuantity && item.baseUnit ? `Saldo dasar: ${item.baseQuantity} ${item.baseUnit}` : ""}</span></td><td className="px-5 py-4"><Badge label={item.status} /></td><td className="px-5 py-4 text-xs text-gray-500">Dikirim: {dateLabel(item.shippedAt)}<br />Diterima: {dateLabel(item.receivedAt)}{item.receiptProofAvailable && <><br /><a href={`/api/distribution/${item.id}/proof`} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">Lihat bukti foto{item.receiptProofMimeType ? ` · ${item.receiptProofMimeType.replace("image/", "")}` : ""}</a></>}</td><td className="px-5 py-4">{actions.length ? <ActionMenu label={`distribusi ${item.itemName}`} items={actions} disabled={submitting} /> : <span className="text-xs text-gray-400">-</span>}</td></tr>; })}{distributions.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">Belum ada distribusi berjalan.</td></tr>}</tbody></table></div></div>

			<Modal isOpen={Boolean(receiptDistribution)} onClose={() => !submitting && setReceiptDistribution(null)} title="Konfirmasi penerimaan barang">{receiptDistribution && <form onSubmit={(event) => { event.preventDefault(); void submitReceive(); }} className="space-y-4"><p className="text-sm text-gray-600">Manager posko tujuan wajib mengunggah foto sebagai bukti barang diterima.</p><div><label htmlFor="receipt-proof" className="mb-1.5 block text-sm font-medium text-slate-700">Bukti foto penerimaan <span className="text-rose-500">*</span></label><input id="receipt-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setReceiptProof(event.target.files?.[0] ?? null)} required className="block w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700" /><p className="mt-1 text-xs text-slate-500">JPG, PNG, atau WebP. Maksimal 5 MB.</p>{receiptProof && <p className="mt-1 text-xs font-medium text-emerald-600">Dipilih: {receiptProof.name}</p>}</div><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setReceiptDistribution(null)} disabled={submitting}>Batal</Button><Button type="submit" disabled={submitting || !receiptProof}>{submitting ? "Menyimpan..." : "Konfirmasi diterima"}</Button></div></form>}</Modal>
			<Modal isOpen={Boolean(approval)} onClose={() => !submitting && setApproval(null)} title="Setujui Permintaan">{approval && <div className="space-y-4"><p className="text-sm text-gray-600">Pilih stok sumber untuk {approval.itemName} dari {approval.sourceCamp.name}. Permintaan: {approval.requestedQuantity ?? approval.quantity} {approval.requestedUnit ?? approval.unit}.</p><SearchableSelect label="Stok sumber" value={approvalStockId} onChange={(value) => { setApprovalStockId(value); setApprovalQuantity(""); }} options={approvalStocks.map((stock) => ({ value: stock.id, label: stock.itemName, meta: `Tersedia ${availableQuantity(stock)} ${stock.unit} · ${availableBaseQuantity(stock)} ${stock.baseUnit}` }))} placeholder="Pilih stok yang cocok" emptyMessage="Tidak ada saldo stok yang cukup." /><FormField label="Jumlah disetujui dalam unit stok" type="number" value={approvalQuantity} onChange={setApprovalQuantity} min={1} max={approvalStock ? availableQuantity(approvalStock) : undefined} required /><p className="text-xs text-slate-500">Maksimal: {approvalStock ? quantityLabel(availableQuantity(approvalStock), approvalStock.unit, availableBaseQuantity(approvalStock), approvalStock.baseUnit) : "pilih stok"}</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setApproval(null)} disabled={submitting}>Batal</Button><Button disabled={submitting || !approvalStockId || !approvalQuantity || Boolean(approvalStock && Number(approvalQuantity) > availableQuantity(approvalStock))} onClick={() => void updateRequest(approval.id, { action: "APPROVE", sourceItemId: approvalStockId, quantity: Number(approvalQuantity) })}>Setujui</Button></div></div>}</Modal>
		</div>
	);
}
