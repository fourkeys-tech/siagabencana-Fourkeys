"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/auth/user-provider";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { occupancyBarClass } from "@/lib/occupancy";

type Logistics = {
	id: string;
	itemName: string;
	status: string;
};

type Facility = {
	id: string;
	facilityName: string;
	status: string;
};

type Camp = {
	id: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	currentOccupants: number;
	availableCapacity: number;
	occupancyPercentage: number;
	status: string;
	availability: "AVAILABLE" | "LIMITED" | "FULL";
	lastUpdatedAt: string | null;
	logistics: Logistics[];
	facilities: Facility[];
};

type Summary = {
	totalActiveCamps: number;
	totalCapacity: number;
	totalOccupants: number;
	totalAvailableCapacity: number;
	availableCamps: number;
	limitedCamps: number;
	fullCamps: number;
	criticalLogistics: number;
	damagedFacilities: number;
	lastUpdatedAt: string | null;
};

type Filter = "ALL" | "AVAILABLE" | "LIMITED" | "FULL";
type Sort = "AVAILABILITY" | "NAME" | "OCCUPANCY";

export const dynamic = "force-dynamic";

const CampMap = nextDynamic(
	() => import("@/components/public/camp-map").then((mod) => mod.CampMap),
	{
		ssr: false,
		loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">Memuat peta...</div>,
	},
);

const availabilityLabels: Record<Camp["availability"], string> = {
	AVAILABLE: "Masih tersedia",
	LIMITED: "Kapasitas terbatas",
	FULL: "Penuh",
};

const statusLabels: Record<string, string> = {
	SUFFICIENT: "Aman",
	LOW: "Menipis",
	CRITICAL: "Kritis",
	SPOILED_OR_DAMAGED: "Rusak",
	GOOD: "Baik",
	DAMAGED: "Rusak",
	REPAIRING: "Dalam perbaikan",
};

function availabilityClass(availability: Camp["availability"]) {
	if (availability === "FULL") return "bg-rose-50 text-rose-700 ring-rose-200";
	if (availability === "LIMITED") return "bg-amber-50 text-amber-700 ring-amber-200";
	return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function statusClass(status: string) {
	if (["CRITICAL", "DAMAGED", "SPOILED_OR_DAMAGED"].includes(status)) return "bg-rose-50 text-rose-700";
	if (["LOW", "REPAIRING"].includes(status)) return "bg-amber-50 text-amber-700";
	return "bg-emerald-50 text-emerald-700";
}

function availabilityDescription(camp: Camp) {
	if (camp.availability === "FULL") return "Belum ada kapasitas yang dapat digunakan.";
	if (camp.availability === "LIMITED") return "Sebaiknya konfirmasi terlebih dahulu sebelum datang.";
	return "Masih memiliki ruang untuk pengungsi baru.";
}

function formatDate(value: string | null | undefined) {
	if (!value) return "Belum tersedia";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Belum tersedia";
	return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function directionsUrl(camp: Camp) {
	return `https://www.google.com/maps/dir/?api=1&destination=${camp.latitude},${camp.longitude}`;
}

export default function PublicPage() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [activeCampId, setActiveCampId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("ALL");
	const [sort, setSort] = useState<Sort>("AVAILABILITY");
	const { user, loading: sessionLoading } = useSession();
	const cardRefs = useRef<Record<string, HTMLElement | null>>({});

	const loadData = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const response = await fetch("/api/public/overview", { cache: "no-store" });
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message ?? "Gagal memuat data publik.");
			setSummary(data.data.summary);
			setCamps(data.data.camps);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan saat memuat data.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadData();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [loadData]);

	const filteredCamps = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return camps
			.filter((camp) => filter === "ALL" || camp.availability === filter)
			.filter((camp) => !normalizedQuery || `${camp.name} ${camp.address}`.toLowerCase().includes(normalizedQuery))
			.sort((first, second) => {
				if (sort === "NAME") return first.name.localeCompare(second.name, "id");
				if (sort === "OCCUPANCY") return first.occupancyPercentage - second.occupancyPercentage;
				return second.availableCapacity - first.availableCapacity;
			});
	}, [camps, filter, query, sort]);

	const selectedCamp = filteredCamps.find((camp) => camp.id === activeCampId) ?? null;
	const visibleActiveCampId = selectedCamp ? activeCampId : null;

	useEffect(() => {
		if (!activeCampId) return;
		cardRefs.current[activeCampId]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
	}, [activeCampId]);

	const selectCamp = (campId: string) => setActiveCampId(campId);
	const scrollToCamp = (campId: string) => cardRefs.current[campId]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<a href="#konten-utama" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-blue-700 focus:shadow-xl">Lewati ke konten utama</a>
			<header className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_#3b82f6,_transparent_42%),linear-gradient(135deg,#0f3f91,#071d49)] text-white">
				<div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
					<div className="grid min-h-20 grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
						<div className="hidden sm:block" />
						<Link href="/public" aria-label="Fourkeys Siaga Bencana" className="mx-auto rounded-xl focus-visible:ring-4 focus-visible:ring-white/50"><Image src="/logo.svg" alt="Fourkeys Siaga Bencana" width={520} height={150} priority className="h-auto w-[min(82vw,22rem)] object-contain sm:w-[min(40vw,32rem)]" /></Link>
						<div className="flex justify-center sm:justify-end"><Link href={user ? "/dashboard" : "/login"} aria-label={user ? "Buka dashboard" : "Masuk ke dashboard"} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-800 shadow-sm transition hover:bg-blue-50 focus-visible:ring-4 focus-visible:ring-white/50 sm:px-4 sm:py-2.5 sm:text-sm">{sessionLoading ? "Memeriksa sesi..." : user ? "Buka Dashboard" : "Masuk ke Dashboard"}</Link></div>
					</div>
					<div className="grid gap-10 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
						<div><span className="inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100 ring-1 ring-white/20">Informasi kapasitas posko untuk masyarakat</span><h1 id="public-heading" className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">Temukan posko evakuasi yang masih siap menerima.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg">Gunakan peta dan daftar posko di bawah untuk melihat lokasi, kapasitas tersisa, kondisi fasilitas, serta status bantuan yang tersedia.</p><a href="#daftar-posko" className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-800 transition hover:bg-blue-50">Lihat daftar posko ↓</a></div>
						<div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur"><p className="text-xs font-bold uppercase tracking-wider text-blue-200">Cara membaca informasi</p><div className="mt-4 space-y-4 text-sm text-blue-50"><p><strong className="text-white">Masih tersedia</strong> berarti masih ada ruang pengungsian.</p><p><strong className="text-white">Kapasitas terbatas</strong> berarti ruang tersisa sedikit dan perlu konfirmasi.</p><p><strong className="text-white">Penuh</strong> berarti tidak ada kapasitas yang dapat digunakan saat ini.</p></div></div>
					</div>
				</div>
			</header>

			<main id="konten-utama" aria-labelledby="public-heading" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
				{error && <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>{error}</p><button type="button" onClick={() => void loadData()} className="rounded-lg bg-white px-3 py-2 font-bold text-rose-700 shadow-sm">Coba lagi</button></div>}
				{loading ? <div className="flex min-h-96 items-center justify-center text-sm text-slate-500">Memuat informasi posko...</div> : <>
					{summary && <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Posko aktif</p><p className="mt-2 text-3xl font-black text-slate-950">{summary.totalActiveCamps}</p><p className="mt-1 text-xs text-slate-500">Lokasi yang dapat dipantau</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Masih tersedia</p><p className="mt-2 text-3xl font-black text-emerald-800">{summary.availableCamps}</p><p className="mt-1 text-xs text-emerald-700">Posko dengan ruang tersisa</p></div><div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Kapasitas tersisa</p><p className="mt-2 text-3xl font-black text-blue-900">{summary.totalAvailableCapacity}</p><p className="mt-1 text-xs text-blue-700">Ruang pengungsi secara total</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Perlu perhatian</p><p className="mt-2 text-3xl font-black text-amber-900">{summary.limitedCamps + summary.fullCamps}</p><p className="mt-1 text-xs text-amber-700">Posko terbatas atau penuh</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pembaruan data</p><p className="mt-2 text-sm font-black text-slate-950">{formatDate(summary.lastUpdatedAt)}</p><p className="mt-1 text-xs text-slate-500">Data operasional terakhir</p></div></section>}

					<section aria-labelledby="map-heading" className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]"><div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-blue-700">Peta interaktif</p><h2 id="map-heading" className="mt-1 text-2xl font-black text-slate-950">Lokasi posko evakuasi</h2></div><p id="map-help" className="text-sm text-slate-600">Pilih marker pada peta atau pilih posko dari daftar di bawah.</p></div><div className="mt-4 h-[430px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><CampMap camps={filteredCamps} activeId={visibleActiveCampId} onSelect={selectCamp} /></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600"><span className="inline-flex items-center gap-2"><i aria-hidden="true" className="h-3 w-3 rounded-full bg-emerald-600" />Masih tersedia</span><span className="inline-flex items-center gap-2"><i aria-hidden="true" className="h-3 w-3 rounded-full bg-amber-600" />Kapasitas terbatas</span><span className="inline-flex items-center gap-2"><i aria-hidden="true" className="h-3 w-3 rounded-full bg-rose-700" />Penuh</span></div></div><aside aria-live="polite" aria-atomic="true" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold uppercase tracking-wider text-blue-700">Posko terpilih</p>{selectedCamp ? <div className="mt-4"><h3 className="text-xl font-black text-slate-950">{selectedCamp.name}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{selectedCamp.address}</p><span className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${availabilityClass(selectedCamp.availability)}`}>{availabilityLabels[selectedCamp.availability]}</span><p className="mt-4 text-sm font-semibold text-slate-800">{selectedCamp.availableCapacity} ruang tersisa dari {selectedCamp.maxCapacity}</p><p className="mt-1 text-sm leading-6 text-slate-500">{availabilityDescription(selectedCamp)}</p><div className="mt-5 grid gap-2"><a href={directionsUrl(selectedCamp)} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-blue-700">Buka petunjuk arah</a><button type="button" onClick={() => scrollToCamp(selectedCamp.id)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Lihat informasi lengkap</button></div></div> : <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-500">Pilih marker pada peta atau kartu posko untuk melihat detail dan petunjuk arah.</div>}</aside></section>

					<section id="daftar-posko" aria-labelledby="camp-list-heading" className="mt-12 scroll-mt-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Daftar lokasi</p><h2 id="camp-list-heading" className="mt-1 text-2xl font-black text-slate-950">Pilih posko yang sesuai</h2><p className="mt-2 text-sm text-slate-500">Informasi dibuat ringkas agar mudah dibaca saat keadaan darurat.</p></div><p role="status" aria-live="polite" className="text-sm font-semibold text-slate-700">{filteredCamps.length} posko ditampilkan</p></div><div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto_auto]"><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Cari lokasi</span><input id="camp-search" aria-describedby="camp-search-help" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama posko atau alamat..." className="min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-500/20" /><span id="camp-search-help" className="sr-only">Ketik nama posko atau alamat untuk menyaring daftar.</span></label><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Ketersediaan</span><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"><option value="ALL">Semua status</option><option value="AVAILABLE">Masih tersedia</option><option value="LIMITED">Kapasitas terbatas</option><option value="FULL">Penuh</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Urutkan</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"><option value="AVAILABILITY">Kapasitas terbesar</option><option value="OCCUPANCY">Okupansi terendah</option><option value="NAME">Nama A–Z</option></select></label></div>
						{filteredCamps.length === 0 ? <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-lg font-bold text-slate-900">Posko tidak ditemukan</p><p className="mt-2 text-sm text-slate-500">Coba ubah kata kunci atau filter ketersediaan.</p></div> : <div className="mt-5 grid gap-5 xl:grid-cols-2">{filteredCamps.map((camp) => <article key={camp.id} ref={(element) => { cardRefs.current[camp.id] = element; }} className={`rounded-3xl border bg-white p-5 shadow-sm transition ${visibleActiveCampId === camp.id ? "border-blue-500 ring-4 ring-blue-500/10" : "border-slate-200"}`}><button type="button" onClick={() => selectCamp(camp.id)} className="w-full text-left"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-black text-slate-950">{camp.name}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{camp.address}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${availabilityClass(camp.availability)}`}>{availabilityLabels[camp.availability]}</span></div><div className="mt-5"><div className="flex justify-between text-sm"><span className="font-semibold text-slate-700">Terisi {camp.currentOccupants} dari {camp.maxCapacity}</span><span className="font-bold text-slate-900">{camp.occupancyPercentage}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${occupancyBarClass(camp.occupancyPercentage)}`} style={{ width: `${Math.min(camp.occupancyPercentage, 100)}%` }} /></div><p className="mt-2 text-sm font-semibold text-slate-600">{camp.availableCapacity} ruang tersisa</p></div></button><div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Bantuan logistik</p><p className="mt-1 text-sm font-semibold text-slate-800">{camp.logistics.length === 0 ? "Belum ada laporan" : `${camp.logistics.filter((item) => item.status === "SUFFICIENT").length} jenis aman, ${camp.logistics.filter((item) => item.status !== "SUFFICIENT").length} perlu perhatian`}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Fasilitas</p><p className="mt-1 text-sm font-semibold text-slate-800">{camp.facilities.length === 0 ? "Belum ada laporan" : `${camp.facilities.filter((item) => item.status === "GOOD").length} fasilitas baik, ${camp.facilities.filter((item) => item.status !== "GOOD").length} perlu perhatian`}</p></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">Diperbarui {formatDate(camp.lastUpdatedAt)}</p><a href={directionsUrl(camp)} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Petunjuk arah ↗</a></div><div className="mt-4 flex flex-wrap gap-2">{camp.logistics.filter((item) => item.status !== "SUFFICIENT").slice(0, 4).map((item) => <span key={item.id} className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.itemName}: {statusLabels[item.status] ?? item.status}</span>)}{camp.facilities.filter((item) => item.status !== "GOOD").slice(0, 3).map((item) => <span key={item.id} className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.facilityName}: {statusLabels[item.status] ?? item.status}</span>)}</div></article>)}</div>}
					</section>
				</>}
			</main>
			<footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-slate-600 sm:px-8 md:flex-row md:items-start md:justify-between"><div className="max-w-2xl space-y-2"><p>Informasi ini diperbarui oleh petugas lapangan. Dalam keadaan darurat, ikuti arahan petugas setempat.</p><p className="text-xs text-slate-500">© {new Date().getFullYear()} Fourkeys Technology. Seluruh hak cipta dilindungi.</p></div><div className="space-y-2 md:max-w-xs md:text-right"><p className="font-bold text-slate-900">Butuh solusi digital untuk organisasi Anda?</p><p className="text-xs leading-5 text-slate-500">Fourkeys Technology menyediakan pengembangan aplikasi dan sistem informasi yang rapi, aman, dan mudah digunakan.</p><Link href={user ? "/dashboard" : "/login"} className="inline-flex font-bold text-blue-700 hover:text-blue-900 hover:underline focus-visible:ring-4 focus-visible:ring-blue-500/30">{user ? "Buka Dashboard →" : "Masuk ke Dashboard →"}</Link></div></div></footer>
		</div>
	);
}
