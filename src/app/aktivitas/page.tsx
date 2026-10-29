"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Clock3 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { enumLabel } from "@/lib/labels";

interface Log {
	id: string;
	action: string;
	entity: string;
	entityId: string | null;
	details: string | null;
	createdAt: string;
	user: { name: string; role: string; division: string | null } | null;
}

function dateLabel(value: string) {
	return new Date(value).toLocaleString("id-ID");
}

function formatDetails(details: string | null) {
	if (!details) return "-";
	try {
		const parsed = JSON.parse(details);
		if (typeof parsed === "object" && parsed !== null) {
			const entries = Object.entries(parsed);
			if (entries.length === 0) return "-";
			return (
				<span className="flex flex-wrap gap-1.5">
					{entries.map(([key, val]) => (
						<span key={key} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
							<span className="font-semibold text-slate-500 mr-1">{key}:</span>
							{String(val)}
						</span>
					))}
				</span>
			);
		}
	} catch {
		// Not JSON, return as-is
	}
	return details;
}

export default function ActivityPage() {
	const [logs, setLogs] = useState<Log[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);

	const loadData = useCallback(async (currentPage = 1) => {
		try {
			const res = await fetch(`/api/activity?page=${currentPage}&limit=25`, { cache: "no-store" });
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message ?? "Gagal mengambil aktivitas.");

			if (data.pagination) {
				setLogs(data.data);
				setPage(data.pagination.page);
				setTotalPages(data.pagination.totalPages);
				setTotal(data.pagination.total);
			} else if (Array.isArray(data.data)) {
				setLogs(data.data);
			}
			setError("");
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Gagal mengambil aktivitas.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		let isMounted = true;
		fetch("/api/activity?page=1&limit=25", { cache: "no-store" })
			.then((res) => res.json())
			.then((data) => {
				if (!isMounted) return;
				if (!data.success) throw new Error(data.message ?? "Gagal mengambil aktivitas.");
				if (data.pagination) {
					setLogs(data.data);
					setPage(data.pagination.page);
					setTotalPages(data.pagination.totalPages);
					setTotal(data.pagination.total);
				} else if (Array.isArray(data.data)) {
					setLogs(data.data);
				}
				setError("");
			})
			.catch((loadError) => {
				if (isMounted) setError(loadError instanceof Error ? loadError.message : "Gagal mengambil aktivitas.");
			})
			.finally(() => {
				if (isMounted) setLoading(false);
			});
		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<div className="space-y-6">
			<div>
				<div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
					<Activity size={14} />Governance & traceability
				</div>
				<h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Riwayat aktivitas</h1>
				<p className="mt-2 text-sm text-slate-500">Jejak aktivitas pengguna untuk menjaga akuntabilitas operasional.</p>
			</div>

			{error && <Alert type="error">{error}</Alert>}

			{loading && logs.length === 0 ? (
				<div className="flex min-h-[45vh] items-center justify-center text-sm text-slate-500">Memuat riwayat...</div>
			) : (
				<Card className="min-w-0 p-0">
					<div className="overflow-x-auto" role="region" aria-label="Riwayat aktivitas" tabIndex={0}>
						<table className="min-w-[60rem] divide-y divide-slate-200">
							<thead className="bg-slate-50">
								<tr>
									{["Waktu", "Pengguna", "Aksi", "Entitas", "Detail"].map((header) => (
										<th key={header} className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
											{header}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{logs.map((log) => (
									<tr key={log.id} className="hover:bg-slate-50">
										<td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
											<span className="flex items-center gap-2">
												<Clock3 size={13} />{dateLabel(log.createdAt)}
											</span>
										</td>
										<td className="px-5 py-4">
											<div className="flex items-center gap-2.5">
												<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
													{log.user?.name?.slice(0, 1) ?? "S"}
												</div>
												<div>
													<p className="text-sm font-semibold text-slate-900">{log.user?.name ?? "Sistem"}</p>
													{log.user && (
														<div className="mt-1 flex flex-wrap gap-1.5">
															<Badge label={log.user.role} />
															{log.user.division && <Badge label={log.user.division} />}
														</div>
													)}
												</div>
											</div>
										</td>
										<td className="px-5 py-4 text-sm font-bold text-slate-800">
											{enumLabel(log.action)}
										</td>
										<td className="px-5 py-4 text-sm text-slate-600">
											{log.entity}{log.entityId ? ` #${log.entityId}` : ""}
										</td>
										<td className="max-w-md px-5 py-4 text-sm text-slate-500">
											{formatDetails(log.details)}
										</td>
									</tr>
								))}
								{logs.length === 0 && (
									<tr>
										<td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
											Belum ada aktivitas tercatat.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					<Pagination
						page={page}
						totalPages={totalPages}
						total={total}
						onPageChange={(newPage) => {
							setLoading(true);
							void loadData(newPage);
						}}
						disabled={loading}
					/>
				</Card>
			)}
		</div>
	);
}
