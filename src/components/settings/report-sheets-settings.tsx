"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, FileSpreadsheet, Unlink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";

type ReportSettings = {
	serviceAccountConfigured: boolean;
	serviceAccountEmail: string | null;
	spreadsheetId: string | null;
	spreadsheetUrl: string | null;
};

const SECTION_ID = "google-sheets";

export function ReportSheetsSettings({ isSuperAdmin }: { isSuperAdmin: boolean }) {
	const [settings, setSettings] = useState<ReportSettings | null>(null);
	const [input, setInput] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [copied, setCopied] = useState(false);
	const sectionRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const controller = new AbortController();
		fetch("/api/settings/reports", { cache: "no-store", signal: controller.signal })
			.then((res) => res.json())
			.then((result) => {
				if (!result.success) {
					setError(result.message ?? "Gagal memuat pengaturan Google Sheets.");
					return;
				}
				setSettings(result.data as ReportSettings);
				// Datang dari tombol "Hubungkan Google Sheets" di halaman Laporan.
				if (window.location.hash === `#${SECTION_ID}`) {
					requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
				}
			})
			.catch((err) => {
				if (err instanceof DOMException && err.name === "AbortError") return;
				setError("Gagal memuat pengaturan Google Sheets.");
			});
		return () => controller.abort();
	}, []);

	const save = async (spreadsheet: string) => {
		setSaving(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/settings/reports", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ spreadsheet }),
			});
			const result = await response.json();
			if (!response.ok || !result.success) throw new Error(result.message ?? "Gagal menyimpan spreadsheet.");
			setSettings(result.data as ReportSettings);
			setInput("");
			setMessage(result.message);
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan spreadsheet.");
		} finally {
			setSaving(false);
		}
	};

	const copyEmail = async () => {
		if (!settings?.serviceAccountEmail) return;
		try {
			await navigator.clipboard.writeText(settings.serviceAccountEmail);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setError("Gagal menyalin. Salin email secara manual.");
		}
	};

	const connected = Boolean(settings?.spreadsheetId);

	return (
		<div id={SECTION_ID} ref={sectionRef} className="scroll-mt-24">
			<Card>
				<div className="mb-5 flex items-center gap-3">
					<div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600"><FileSpreadsheet size={19} aria-hidden="true" /></div>
					<div>
						<h2 className="font-bold text-slate-950">Ekspor Google Sheets</h2>
						<p className="text-xs text-slate-500">Spreadsheet tujuan tombol &quot;Kirim ke Google Sheets&quot; di halaman Laporan. Berlaku untuk akun Anda saja; setiap ekspor membuat tab baru.</p>
					</div>
				</div>

				{!settings && !error && (
					<div className="space-y-3" aria-hidden="true">
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-11 w-full" />
					</div>
				)}

				{settings && (
					<div className="space-y-5">
						{!settings.serviceAccountConfigured && (
							<Alert type="warning">
								{isSuperAdmin
									? "Service account Google belum dikonfigurasi. Isi GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 di environment server (sekali untuk semua akun). Spreadsheet tetap bisa disimpan, tetapi ekspor belum dapat dijalankan."
									: "Integrasi Google belum diaktifkan di server. Hubungi Super Admin. Spreadsheet tetap bisa disimpan untuk dipakai nanti."}
							</Alert>
						)}

						{connected && settings.spreadsheetUrl && (
							<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
								<div className="min-w-0">
									<p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Terhubung</p>
									<p className="mt-1 truncate font-mono text-xs text-emerald-900" title={settings.spreadsheetId ?? undefined}>{settings.spreadsheetId}</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<a
										href={settings.spreadsheetUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
									>
										Buka <ExternalLink size={14} aria-hidden="true" />
									</a>
									<Button variant="ghost" onClick={() => void save("")} disabled={saving}>
										<Unlink size={15} aria-hidden="true" />
										Putuskan
									</Button>
								</div>
							</div>
						)}

						<ol className="space-y-3 text-sm text-slate-600">
							<li className="flex gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">1</span>
								<span>Buat atau buka Google Spreadsheet milik Anda.</span>
							</li>
							<li className="flex gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">2</span>
								<div className="min-w-0 flex-1">
									<p>Klik <strong>Bagikan</strong>, tambahkan email berikut sebagai <strong>Editor</strong>:</p>
									{settings.serviceAccountEmail ? (
										<div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pl-3">
											<code className="min-w-0 flex-1 truncate text-xs text-slate-800">{settings.serviceAccountEmail}</code>
											<button
												type="button"
												onClick={() => void copyEmail()}
												className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
												aria-label="Salin email service account"
											>
												{copied ? <Check size={14} className="text-emerald-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
												{copied ? "Disalin" : "Salin"}
											</button>
										</div>
									) : (
										<p className="mt-1 text-xs italic text-slate-400">Email service account tampil setelah server dikonfigurasi.</p>
									)}
								</div>
							</li>
							<li className="flex gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">3</span>
								<span>Tempel URL spreadsheet di bawah lalu simpan. Akses tulis diuji otomatis.</span>
							</li>
						</ol>

						<form
							onSubmit={(event) => {
								event.preventDefault();
								void save(input);
							}}
						>
							<FormField
								label={connected ? "Ganti spreadsheet (URL atau ID)" : "URL atau ID spreadsheet"}
								value={input}
								onChange={setInput}
								placeholder="https://docs.google.com/spreadsheets/d/…/edit"
								maxLength={500}
								required
								disabled={saving}
							/>
							<div className="flex justify-end">
								<Button type="submit" disabled={saving || !input.trim()}>
									{saving ? "Menguji akses..." : "Simpan & uji akses"}
								</Button>
							</div>
						</form>
					</div>
				)}

				{error && <div className="mt-4"><Alert type="error">{error}</Alert></div>}
				{message && <div className="mt-4"><Alert type="success">{message}</Alert></div>}
			</Card>
		</div>
	);
}
