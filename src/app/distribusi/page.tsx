"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField, FormSelect } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useSession } from "@/components/auth/user-provider";

type Camp = { id: string; name: string; status: string };
type Stock = { id: string; campId: string; itemName: string; quantity: number; reservedQuantity: number; damagedQuantity: number; unit: string };
type Request = {
	id: string;
	sourceCampId: string;
	destinationCampId: string;
	itemName: string;
	quantity: number;
	unit: string;
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
	status: string;
	shippedAt: string | null;
	receivedAt: string | null;
	sourceCamp: { id: string; name: string };
	destinationCamp: { id: string; name: string };
};

const initialForm = {
	sourceCampId: "",
	destinationCampId: "",
	itemName: "",
	quantity: "",
	unit: "",
	notes: "",
};

function dateLabel(value: string | null) {
	return value ? new Date(value).toLocaleString("id-ID") : "-";
}

export default function DistributionPage() {
	const { user, loading: userLoading } = useSession();
	const [camps, setCamps] = useState<Camp[]>([]);
	const [stocks, setStocks] = useState<Stock[]>([]);
	const [requests, setRequests] = useState<Request[]>([]);
	const [distributions, setDistributions] = useState<Distribution[]>([]);
	const [form, setForm] = useState(initialForm);
	const [approval, setApproval] = useState<Request | null>(null);
	const [approvalStockId, setApprovalStockId] = useState("");
	const [approvalQuantity, setApprovalQuantity] = useState("");
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const [campRes, stockRes, distributionRes] = await Promise.all([
				fetch("/api/public/camps", { cache: "no-store" }),
				fetch("/api/logistics", { cache: "no-store" }),
				fetch("/api/distribution", { cache: "no-store" }),
			]);
			const [campData, stockData, distributionData] = await Promise.all([
				campRes.json(),
				stockRes.json(),
				distributionRes.json(),
			]);

			if (!stockRes.ok || !stockData.success) throw new Error(stockData.message);
			if (!distributionRes.ok || !distributionData.success) {
				throw new Error(distributionData.message);
			}

			setCamps(campData.success ? campData.data : []);
			setStocks(stockData.data ?? []);
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

		const timer = window.setTimeout(() => {
			loadData();
		}, 0);

		return () => window.clearTimeout(timer);
	}, [loadData, user, userLoading]);

	const sourceOptions = camps
		.filter((camp) => camp.id !== (user?.role === "SUPER_ADMIN" ? form.destinationCampId : user?.campId))
		.map((camp) => ({ value: camp.id, label: camp.name }));
	const destinationOptions = camps
		.filter((camp) => camp.id !== form.sourceCampId && camp.id !== user?.campId)
		.map((camp) => ({ value: camp.id, label: camp.name }));
	const approvalStocks = useMemo(() => {
		if (!approval) return [];
		return stocks.filter(
			(stock) =>
				stock.campId === approval.sourceCampId &&
				stock.itemName.toLowerCase() === approval.itemName.toLowerCase() &&
				stock.unit.toLowerCase() === approval.unit.toLowerCase() &&
				stock.quantity - stock.reservedQuantity > 0,
		);
	}, [approval, stocks]);

	const updateForm = (key: keyof typeof initialForm, value: string) => {
		setForm((current) => ({ ...current, [key]: value }));
	};

	const submitRequest = async () => {
		setSubmitting(true);
		setError("");
		setMessage("");
		try {
			const res = await fetch("/api/distribution", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
			});
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
			const res = await fetch(`/api/distribution/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
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

	const canCreate = user?.role === "SUPER_ADMIN" || user?.division === "LOGISTICS";
	const destinationCamp = user?.role === "SUPER_ADMIN" ? form.destinationCampId : user?.campId ?? "";

	if (userLoading || loading) {
		return <div className="flex h-64 items-center justify-center text-gray-500">Memuat...</div>;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-gray-900">Distribusi Logistik</h1>
				<p className="mt-1 text-sm text-gray-500">Kelola permintaan, pengiriman, dan penerimaan logistik antar posko.</p>
			</div>

			{error && <Alert type="error">{error}</Alert>}
			{message && <Alert type="success">{message}</Alert>}

			{!canCreate && (
				<Alert type="warning">Fitur distribusi hanya tersedia untuk pengguna divisi logistik.</Alert>
			)}

			{canCreate && (
				<div className="rounded-lg border bg-white p-5 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">Buat Permintaan Logistik</h2>
					<div className="grid gap-4 md:grid-cols-2">
						<FormSelect label="Posko Asal" value={form.sourceCampId} onChange={(value) => updateForm("sourceCampId", value)} options={[{ value: "", label: "Pilih posko asal" }, ...sourceOptions]} required />
						{user?.role === "SUPER_ADMIN" ? (
							<FormSelect label="Posko Tujuan" value={form.destinationCampId} onChange={(value) => updateForm("destinationCampId", value)} options={[{ value: "", label: "Pilih posko tujuan" }, ...destinationOptions]} required />
						) : (
							<div className="mb-4">
								<p className="mb-1 block text-sm font-medium text-gray-700">Posko Tujuan</p>
								<div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">{user?.camp?.name ?? "Posko akun belum tersedia"}</div>
							</div>
						)}
						<FormField label="Nama Barang" value={form.itemName} onChange={(value) => updateForm("itemName", value)} required />
						<FormField label="Jumlah" type="number" value={form.quantity} onChange={(value) => updateForm("quantity", value)} required />
						<FormField label="Unit" value={form.unit} onChange={(value) => updateForm("unit", value)} placeholder="dus, kg, box" required />
						<FormField label="Catatan" value={form.notes} onChange={(value) => updateForm("notes", value)} />
					</div>
					<div className="flex justify-end">
						<Button onClick={submitRequest} disabled={submitting || !destinationCamp}>{submitting ? "Menyimpan..." : "Buat Permintaan"}</Button>
					</div>
				</div>
			)}

			<div className="rounded-lg border bg-white shadow-sm">
				<div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Permintaan Logistik</h2></div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50"><tr>{["Barang", "Rute", "Jumlah", "Status", "Aksi"].map((header) => <th key={header} className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">{header}</th>)}</tr></thead>
						<tbody className="divide-y divide-gray-100">
							{requests.map((item) => {
								const canReview = user?.role === "SUPER_ADMIN" || (user?.division === "LOGISTICS" && user.campId === item.sourceCampId);
								return <tr key={item.id}>
									<td className="px-5 py-4 text-sm"><p className="font-medium text-gray-900">{item.itemName}</p><p className="text-gray-500">{item.notes || "Tanpa catatan"}</p></td>
									<td className="px-5 py-4 text-sm text-gray-600">{item.sourceCamp.name} → {item.destinationCamp.name}</td>
									<td className="px-5 py-4 text-sm text-gray-600">{item.quantity} {item.unit}</td>
									<td className="px-5 py-4"><Badge label={item.status} />{item.rejectionReason && <p className="mt-1 max-w-48 text-xs text-red-600">{item.rejectionReason}</p>}</td>
									<td className="px-5 py-4"><div className="flex gap-2">{item.status === "PENDING" && canReview && <>											<Button className="px-3 py-1.5" onClick={() => { setApproval(item); setApprovalQuantity(String(item.quantity)); setApprovalStockId(""); }}>Setujui & Reservasi</Button><Button variant="danger" className="px-3 py-1.5" onClick={() => { const reason = window.prompt("Alasan penolakan:"); if (reason) updateRequest(item.id, { action: "REJECT", rejectionReason: reason }); }}>Tolak</Button></>}														{item.distribution && <span className="text-xs text-gray-500">Stok diproses</span>}</div></td>
								</tr>;
							})}
							{requests.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">Belum ada permintaan distribusi.</td></tr>}
						</tbody>
					</table>
				</div>
			</div>

			<div className="rounded-lg border bg-white shadow-sm">
				<div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Riwayat Distribusi</h2></div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50"><tr>{["Barang", "Rute", "Jumlah", "Status", "Waktu", "Aksi"].map((header) => <th key={header} className="px-5 py-3 text-left text-xs font-medium uppercase text-gray-500">{header}</th>)}</tr></thead>
						<tbody className="divide-y divide-gray-100">
							{distributions.map((item) => {
								const canShip = user?.role === "SUPER_ADMIN" || (user?.division === "LOGISTICS" && user.campId === item.sourceCamp.id);
								const canReceive = user?.role === "SUPER_ADMIN" || (user?.division === "LOGISTICS" && user.campId === item.destinationCamp.id);
								return <tr key={item.id}><td className="px-5 py-4 text-sm font-medium text-gray-900">{item.itemName}</td><td className="px-5 py-4 text-sm text-gray-600">{item.sourceCamp.name} → {item.destinationCamp.name}</td><td className="px-5 py-4 text-sm text-gray-600">{item.quantity} {item.unit}</td><td className="px-5 py-4"><Badge label={item.status} /></td><td className="px-5 py-4 text-xs text-gray-500">Dikirim: {dateLabel(item.shippedAt)}<br />Diterima: {dateLabel(item.receivedAt)}</td><td className="px-5 py-4">{(item.status === "RESERVED" || item.status === "APPROVED") && canShip && <Button className="px-3 py-1.5" onClick={() => updateRequest(item.id, { action: "SHIP" })}>Kirim</Button>}{item.status === "SHIPPED" && canReceive && <Button className="px-3 py-1.5" onClick={() => updateRequest(item.id, { action: "RECEIVE" })}>Terima</Button>}{item.status === "RESERVED" && canShip && <Button variant="danger" className="px-3 py-1.5" onClick={() => updateRequest(item.id, { action: "CANCEL" })}>Batalkan</Button>}</td></tr>;
			})}
			{distributions.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">Belum ada distribusi berjalan.</td></tr>}
			</tbody>
					</table>
				</div>
			</div>

			<Modal isOpen={Boolean(approval)} onClose={() => setApproval(null)} title="Setujui Permintaan">
				{approval && <div><p className="mb-4 text-sm text-gray-600">Pilih stok sumber untuk {approval.itemName} dari {approval.sourceCamp.name}.</p><FormSelect label="Stok Sumber" value={approvalStockId} onChange={setApprovalStockId} options={[{ value: "", label: "Pilih stok" }, ...approvalStocks.map((stock) => ({ value: stock.id, label: `${stock.itemName} — ${stock.quantity} ${stock.unit}` }))]} required /><FormField label="Jumlah Disetujui" type="number" value={approvalQuantity} onChange={setApprovalQuantity} required /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setApproval(null)}>Batal</Button><Button disabled={submitting || !approvalStockId} onClick={() => updateRequest(approval.id, { action: "APPROVE", sourceItemId: approvalStockId, quantity: Number(approvalQuantity) })}>Setujui</Button></div></div>}
			</Modal>
		</div>
	);
}
