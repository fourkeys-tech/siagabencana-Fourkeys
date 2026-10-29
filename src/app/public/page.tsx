"use client";

import Image from "next/image";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "@/components/auth/user-provider";
import { Modal } from "@/components/ui/modal";
import { usePolling } from "@/lib/use-polling";
import {
	availabilityBarClasses,
	availabilityLabels,
	buildShareText,
	directionsUrl,
	distanceKm,
	facilityKind,
	filterAndSortCamps,
	findNearestOpenCamp,
	formatDistance,
	formatRelativeTime,
	parseFilterParam,
	parseSortParam,
	type Availability,
	type AvailabilityFilter,
	type CampSort,
} from "@/lib/public-camps";
import {
	AlertTriangle,
	ArrowUp,
	Check,
	CheckCircle2,
	Clock,
	Copy,
	Droplets,
	HeartPulse,
	Info,
	LocateFixed,
	Map as MapIcon,
	MapPin,
	MessageCircle,
	Navigation,
	Package,
	PhoneCall,
	RotateCw,
	Search,
	Share2,
	ShieldAlert,
	Tent,
	Toilet,
	Users,
	Utensils,
	WifiOff,
	X,
	Zap,
} from "lucide-react";

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
	availability: Availability;
	lastUpdatedAt: string | null;
	logistics: Logistics[];
	facilities: Facility[];
	distance?: number;
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

type UserLocation = { latitude: number; longitude: number; accuracy: number };
type ModalTab = "FACILITIES" | "LOGISTICS";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 60_000;

const CampMap = nextDynamic(
	() => import("@/components/public/camp-map").then((mod) => mod.CampMap),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
				Memuat peta interaktif...
			</div>
		),
	},
);

const statusLabels: Record<string, string> = {
	SUFFICIENT: "Aman",
	LOW: "Menipis",
	CRITICAL: "Kritis",
	SPOILED_OR_DAMAGED: "Rusak / Kedaluwarsa",
	GOOD: "Baik",
	DAMAGED: "Rusak",
	REPAIRING: "Dalam perbaikan",
};

const filterOptions: { value: AvailabilityFilter; label: string; dot?: string; active: string; idle: string }[] = [
	{ value: "ALL", label: "Semua", active: "bg-slate-900 text-white", idle: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
	{ value: "AVAILABLE", label: "Masih Tersedia", dot: "bg-emerald-500", active: "bg-emerald-600 text-white", idle: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
	{ value: "LIMITED", label: "Terbatas", dot: "bg-amber-500", active: "bg-amber-600 text-white", idle: "bg-amber-50 text-amber-800 hover:bg-amber-100" },
	{ value: "FULL", label: "Penuh", dot: "bg-rose-500", active: "bg-rose-600 text-white", idle: "bg-rose-50 text-rose-800 hover:bg-rose-100" },
	{ value: "ATTENTION", label: "Terbatas & Penuh", dot: "bg-orange-500", active: "bg-orange-600 text-white", idle: "bg-orange-50 text-orange-800 hover:bg-orange-100" },
];

// Nomor darurat nasional. Tambahkan nomor resmi BPBD/PMI setempat di sini setelah diverifikasi.
const emergencyContacts = [
	{ number: "112", label: "Call Center Darurat 112", short: "Darurat 112" },
	{ number: "119", label: "Ambulans / Kesehatan 119", short: "Ambulans 119" },
	{ number: "115", label: "Basarnas (SAR) 115", short: "SAR 115" },
	{ number: "113", label: "Pemadam Kebakaran 113", short: "Damkar 113" },
];

function availabilityClass(availability: Availability) {
	if (availability === "FULL") return "bg-rose-50 text-rose-700 ring-rose-200";
	if (availability === "LIMITED") return "bg-amber-50 text-amber-700 ring-amber-200";
	return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function capacityTextClass(availability: Availability) {
	if (availability === "FULL") return "text-rose-700";
	if (availability === "LIMITED") return "text-amber-700";
	return "text-emerald-700";
}

function statusBadgeClass(status: string) {
	if (["CRITICAL", "DAMAGED", "SPOILED_OR_DAMAGED"].includes(status)) return "bg-rose-50 text-rose-700 border-rose-200";
	if (["LOW", "REPAIRING"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-200";
	return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function availabilityDescription(camp: Camp) {
	if (camp.availability === "FULL") return "Belum ada kapasitas yang dapat digunakan saat ini.";
	if (camp.availability === "LIMITED") return "Ruang tersisa sangat sedikit, prioritaskan kelompok rentan.";
	return "Masih memiliki ruang yang siap menerima pengungsi baru.";
}

function formatDate(value: string | null | undefined) {
	if (!value) return "Belum tersedia";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Belum tersedia";
	return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function firstParam(value: string | string[] | undefined) {
	return (Array.isArray(value) ? value[0] : value) ?? null;
}

function scrollBehavior(): ScrollBehavior {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function subscribeOnline(callback: () => void) {
	window.addEventListener("online", callback);
	window.addEventListener("offline", callback);
	return () => {
		window.removeEventListener("online", callback);
		window.removeEventListener("offline", callback);
	};
}

async function copyText(text: string) {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// lanjut ke fallback textarea
	}
	const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.top = "-1000px";
	document.body.appendChild(textarea);
	textarea.select();
	try {
		return document.execCommand("copy");
	} catch {
		return false;
	} finally {
		textarea.remove();
		previousFocus?.focus();
	}
}

function FacilityIcon({ name, className = "h-3.5 w-3.5 shrink-0" }: { name: string; className?: string }) {
	switch (facilityKind(name)) {
		case "TOILET":
			return <Toilet className={className} aria-hidden="true" />;
		case "WATER":
			return <Droplets className={className} aria-hidden="true" />;
		case "POWER":
			return <Zap className={className} aria-hidden="true" />;
		case "HEALTH":
			return <HeartPulse className={className} aria-hidden="true" />;
		case "SHELTER":
			return <Tent className={className} aria-hidden="true" />;
		case "KITCHEN":
			return <Utensils className={className} aria-hidden="true" />;
		default:
			return <Info className={className} aria-hidden="true" />;
	}
}

export default function PublicPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = use(searchParams);
	const initialCampId = firstParam(params.posko);

	const [summary, setSummary] = useState<Summary | null>(null);
	const [camps, setCamps] = useState<Camp[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");
	const [now, setNow] = useState(0);
	const [activeCampId, setActiveCampId] = useState<string | null>(initialCampId);
	const [query, setQuery] = useState(() => firstParam(params.q) ?? "");
	const [filter, setFilter] = useState<AvailabilityFilter>(() => parseFilterParam(firstParam(params.status)));
	const [sort, setSort] = useState<CampSort>(() => parseSortParam(firstParam(params.urut)) ?? "AVAILABILITY");
	const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
	const [locating, setLocating] = useState(false);
	const [locationError, setLocationError] = useState("");
	const [focusRequest, setFocusRequest] = useState<{ latitude: number; longitude: number; key: number; campId?: string } | null>(null);
	const [copiedCampId, setCopiedCampId] = useState<string | null>(null);
	const [modalCampId, setModalCampId] = useState<string | null>(initialCampId);
	const [modalTab, setModalTab] = useState<ModalTab>("FACILITIES");
	const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
	const [showBackToTop, setShowBackToTop] = useState(false);

	const { user, loading: sessionLoading } = useSession();
	const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const mapSectionRef = useRef<HTMLElement | null>(null);
	const cardRefs = useRef<Record<string, HTMLElement | null>>({});
	const inFlightRef = useRef(false);
	const timersRef = useRef<{ toast?: number; copied?: number }>({});

	const pendingNearestScrollRef = useRef(false);
	const nearestRef = useRef<HTMLElement | null>(null);

	const showToast = useCallback((message: string) => {
		window.clearTimeout(timersRef.current.toast);
		setToast({ id: Date.now(), message });
		timersRef.current.toast = window.setTimeout(() => setToast(null), 3200);
	}, []);

	useEffect(() => {
		const timers = timersRef.current;
		return () => {
			window.clearTimeout(timers.toast);
			window.clearTimeout(timers.copied);
		};
	}, []);

	const loadData = useCallback(async (mode: "background" | "manual" = "background") => {
		if (inFlightRef.current) return;
		inFlightRef.current = true;
		if (mode === "manual") setRefreshing(true);
		try {
			const response = await fetch("/api/public/overview", { cache: "no-store" });
			const data = await response.json().catch(() => null);
			if (!response.ok || !data?.success) throw new Error(data?.message ?? "Gagal memuat data publik.");
			setSummary(data.data.summary);
			setCamps(data.data.camps);
			setError("");
			setNow(Date.now());
			if (mode === "manual") showToast("Data posko berhasil diperbarui.");
		} catch (loadError) {
			if (!navigator.onLine) setError("Perangkat sedang offline. Data terakhir yang berhasil dimuat tetap ditampilkan.");
			else setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan saat memuat data.");
		} finally {
			inFlightRef.current = false;
			setLoading(false);
			setRefreshing(false);
		}
	}, [showToast]);

	// Muat awal + refresh otomatis (berhenti saat tab tidak terlihat, lanjut saat kembali).
	usePolling(loadData, POLL_INTERVAL_MS);

	useEffect(() => {
		const onOnline = () => void loadData();
		window.addEventListener("online", onOnline);
		return () => window.removeEventListener("online", onOnline);
	}, [loadData]);

	useEffect(() => {
		const interval = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(interval);
	}, []);

	useEffect(() => {
		const onScroll = () => setShowBackToTop(window.scrollY > 800);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
			const target = event.target instanceof HTMLElement ? event.target : null;
			if (target?.closest("input, textarea, select, [contenteditable='true']") || document.querySelector("[role='dialog']")) return;
			event.preventDefault();
			searchInputRef.current?.focus();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	const requestLocation = useCallback((options: { center?: boolean; scrollToNearest?: boolean } = {}) => {
		// Pesan juga dikirim ke toast agar terlihat dari bagian mana pun halaman.
		const fail = (message: string) => {
			setLocationError(message);
			showToast(message);
		};
		if (!("geolocation" in navigator)) {
			fail("Perangkat atau browser ini tidak mendukung deteksi lokasi.");
			return;
		}
		if (!window.isSecureContext) {
			fail("Deteksi lokasi hanya berfungsi melalui koneksi aman (HTTPS).");
			return;
		}
		setLocating(true);
		setLocationError("");
		navigator.geolocation.getCurrentPosition(
			(position) => {
				const next = {
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracy: position.coords.accuracy,
				};
				pendingNearestScrollRef.current = Boolean(options.scrollToNearest);
				setUserLocation(next);
				if (options.center) setFocusRequest({ latitude: next.latitude, longitude: next.longitude, key: Date.now() });
				setSort("DISTANCE");
				setLocating(false);
				showToast("Lokasi ditemukan. Posko diurutkan dari yang terdekat.");
			},
			(geoError) => {
				setLocating(false);
				if (geoError.code === geoError.PERMISSION_DENIED) {
					fail("Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser, lalu coba lagi.");
				} else if (geoError.code === geoError.TIMEOUT) {
					fail("Pencarian lokasi terlalu lama. Pastikan GPS aktif, lalu coba lagi.");
				} else {
					fail("Lokasi perangkat belum dapat dideteksi. Coba lagi di area terbuka atau cari posko secara manual.");
				}
			},
			{ enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
		);
	}, [showToast]);

	const centerOnUser = () => {
		if (!userLocation) {
			requestLocation({ center: true });
			return;
		}
		setFocusRequest({ latitude: userLocation.latitude, longitude: userLocation.longitude, key: Date.now() });
	};

	const campsWithDistance = useMemo<Camp[]>(() => {
		if (!userLocation) return camps;
		return camps.map((camp) => ({ ...camp, distance: distanceKm(userLocation, camp) }));
	}, [camps, userLocation]);

	const effectiveSort: CampSort = sort === "DISTANCE" && !userLocation ? "AVAILABILITY" : sort;

	const filteredCamps = useMemo(
		() => filterAndSortCamps(campsWithDistance, { filter, query, sort: effectiveSort }),
		[campsWithDistance, filter, query, effectiveSort],
	);

	// Jumlah per status mengikuti kata kunci pencarian yang sedang aktif.
	const filterCounts = useMemo(() => {
		const counts: Record<AvailabilityFilter, number> = { ALL: 0, ATTENTION: 0, AVAILABLE: 0, LIMITED: 0, FULL: 0 };
		filterAndSortCamps(campsWithDistance, { filter: "ALL", query, sort: "NAME" }).forEach((camp) => {
			counts.ALL += 1;
			counts[camp.availability] += 1;
			if (camp.availability !== "AVAILABLE") counts.ATTENTION += 1;
		});
		return counts;
	}, [campsWithDistance, query]);

	const nearestCamp = useMemo(() => findNearestOpenCamp(campsWithDistance), [campsWithDistance]);
	const selectedCamp = filteredCamps.find((camp) => camp.id === activeCampId) ?? null;
	const visibleActiveCampId = selectedCamp ? selectedCamp.id : null;
	const modalCamp = campsWithDistance.find((camp) => camp.id === modalCampId) ?? null;
	const sharedCampId = loading ? modalCampId : modalCamp?.id ?? null;
	const lastUpdatedRelative = now > 0 ? formatRelativeTime(summary?.lastUpdatedAt, now) : null;
	const hasActiveFilters = filter !== "ALL" || query.trim() !== "";

	// Setelah lokasi didapat dari tombol "Cari Posko Terdekat", arahkan ke kartu rekomendasi
	// (atau ke daftar yang sudah urut jarak bila semua posko penuh).
	useEffect(() => {
		if (!pendingNearestScrollRef.current || !userLocation || loading) return;
		pendingNearestScrollRef.current = false;
		const target = nearestRef.current ?? document.getElementById("daftar-posko");
		target?.scrollIntoView({ behavior: scrollBehavior(), block: nearestRef.current ? "center" : "start" });
		nearestRef.current?.focus({ preventScroll: true });
	}, [userLocation, loading]);

	// Sinkronkan pencarian, filter, urutan, dan posko yang dibuka ke URL agar bisa dibagikan.
	useEffect(() => {
		const url = new URL(window.location.href);
		const entries: [string, string | null][] = [
			["q", query.trim() || null],
			["status", filter === "ALL" ? null : filter],
			["urut", sort === "AVAILABILITY" || sort === "DISTANCE" ? null : sort],
			["posko", sharedCampId],
		];
		entries.forEach(([key, value]) => {
			if (value) url.searchParams.set(key, value);
			else url.searchParams.delete(key);
		});
		if (url.search !== window.location.search) {
			window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
		}
	}, [query, filter, sort, sharedCampId]);

	const scrollToSection = (element: Element | null) => {
		element?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
	};

	const showCampOnMap = (campId: string) => {
		// Posko sudah aktif: peta tidak bereaksi pada activeId yang sama, jadi minta pemusatan ulang.
		const camp = filteredCamps.find((item) => item.id === campId);
		if (camp && visibleActiveCampId === campId) {
			setFocusRequest({ latitude: camp.latitude, longitude: camp.longitude, key: Date.now(), campId });
		}
		setActiveCampId(campId);
		setModalCampId(null);
		if (!filteredCamps.some((camp) => camp.id === campId)) {
			setFilter("ALL");
			setQuery("");
		}
		// Tunggu modal tertutup & kunci scroll body dilepas agar smooth scroll tidak terputus.
		window.requestAnimationFrame(() => scrollToSection(mapSectionRef.current));
	};

	const scrollToCard = (campId: string) => {
		cardRefs.current[campId]?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
		cardRefs.current[campId]?.focus({ preventScroll: true });
	};

	const openDetail = useCallback((campId: string, tab: ModalTab = "FACILITIES") => {
		setModalTab(tab);
		setModalCampId(campId);
	}, []);

	const findNearest = () => {
		if (userLocation && nearestRef.current) {
			nearestRef.current.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
			nearestRef.current.focus({ preventScroll: true });
			return;
		}
		requestLocation({ scrollToNearest: true });
	};

	const applyKpiFilter = (next: AvailabilityFilter, label: string) => {
		const value = filter === next && next !== "ALL" ? "ALL" : next;
		setFilter(value);
		const count = filterAndSortCamps(campsWithDistance, { filter: value, query, sort: "NAME" }).length;
		showToast(value === "ALL" ? `Menampilkan semua ${count} posko.` : `Menampilkan ${count} posko ${label}.`);
	};

	const resetFilters = () => {
		setQuery("");
		setFilter("ALL");
	};

	const campLink = (campId: string) => `${window.location.origin}${window.location.pathname}?posko=${encodeURIComponent(campId)}`;

	const markCopied = (campId: string) => {
		window.clearTimeout(timersRef.current.copied);
		setCopiedCampId(campId);
		timersRef.current.copied = window.setTimeout(() => setCopiedCampId(null), 2500);
	};

	const handleCopyCamp = async (camp: Camp) => {
		if (await copyText(buildShareText(camp, campLink(camp.id)))) {
			markCopied(camp.id);
			showToast("Info posko disalin. Tempel di WhatsApp, SMS, atau grup warga.");
		} else {
			showToast("Gagal menyalin otomatis. Gunakan tombol WhatsApp.");
		}
	};

	const handleShareCamp = async (camp: Camp) => {
		if (typeof navigator.share === "function") {
			try {
				await navigator.share({ title: camp.name, text: buildShareText(camp, campLink(camp.id)) });
				return;
			} catch (shareError) {
				// Pengguna menutup lembar bagikan: jangan lanjut menyalin.
				if (shareError instanceof DOMException && shareError.name === "AbortError") return;
			}
		}
		await handleCopyCamp(camp);
	};

	const handleWhatsAppCamp = (camp: Camp) => {
		const text = buildShareText(camp, campLink(camp.id));
		window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
	};

	const onModalTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
		event.preventDefault();
		const next: ModalTab = event.key === "Home" ? "FACILITIES" : event.key === "End" ? "LOGISTICS" : modalTab === "FACILITIES" ? "LOGISTICS" : "FACILITIES";
		setModalTab(next);
		event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab='${next}']`)?.focus();
	};

	return (
		<div className="min-h-screen bg-slate-50 pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-slate-900 sm:pb-0">
			<a
				href="#konten-utama"
				className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-blue-700 focus:shadow-xl"
			>
				Lewati ke konten utama
			</a>

			{!online && (
				<div role="status" className="flex items-center justify-center gap-2 bg-slate-900 px-4 py-2 text-center text-xs font-semibold text-white">
					<WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
					Anda sedang offline. Data yang tampil adalah data terakhir. Panggilan telepon darurat tetap bisa dilakukan.
				</div>
			)}

			{/* Emergency Topbar */}
			<section aria-label="Nomor telepon darurat" className="border-b border-rose-300 bg-rose-600 text-white shadow-sm">
				<div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-xs sm:px-8 sm:text-sm">
					<div className="flex shrink-0 items-center gap-2 font-bold">
						<ShieldAlert className="h-4 w-4" aria-hidden="true" />
						<span className="hidden sm:inline">PANGGILAN DARURAT:</span>
					</div>
					<ul className="-my-1 flex min-w-0 flex-1 snap-x items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
						{emergencyContacts.map((contact) => (
							<li key={contact.number} className="shrink-0 snap-start">
								<a
									href={`tel:${contact.number}`}
									aria-label={`Telepon ${contact.label}`}
									className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 font-semibold transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
								>
									<PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
									<span className="sm:hidden">{contact.short}</span>
									<span className="hidden sm:inline">{contact.label}</span>
								</a>
							</li>
						))}
					</ul>
				</div>
			</section>

			{/* Hero Header */}
			<header className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_#2563eb,_transparent_46%),linear-gradient(135deg,#0d3882,#06173a)] text-white">
				<div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
					<div className="grid min-h-16 grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
						<div className="hidden sm:block" />
						<Link
							href="/public"
							aria-label="Fourkeys Siaga Bencana"
							className="mx-auto rounded-xl focus-visible:ring-4 focus-visible:ring-white/50"
						>
							<Image
								src="/logo.svg"
								alt="Fourkeys Siaga Bencana"
								width={520}
								height={150}
								priority
								className="h-auto w-[min(82vw,22rem)] object-contain sm:w-[min(40vw,30rem)]"
							/>
						</Link>
						<div className="flex justify-center sm:justify-end">
							<Link
								href={user ? "/dashboard" : "/login"}
								aria-label={user ? "Buka dashboard" : "Masuk ke dashboard petugas"}
								className="rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-blue-900 shadow-sm transition hover:bg-blue-50 focus-visible:ring-4 focus-visible:ring-white/50 sm:px-4 sm:py-2.5 sm:text-sm"
							>
								{sessionLoading ? "Memeriksa sesi..." : user ? "Buka Dashboard" : "Masuk Petugas"}
							</Link>
						</div>
					</div>

					<div className="grid gap-8 py-8 sm:py-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
						<div>
							<span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100 ring-1 ring-white/20">
								<span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-slate-400"}`} />
								{lastUpdatedRelative ? `Data diperbarui ${lastUpdatedRelative}` : "Portal Informasi Publik & Evakuasi Cepat"}
							</span>
							<h1 id="public-heading" className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-5xl lg:text-6xl">
								Temukan posko evakuasi yang masih siap menerima.
							</h1>
							<p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base sm:leading-7">
								Pantau kapasitas ruang secara real-time, kondisi ketersediaan logistik bantuan, dan petunjuk navigasi tercepat menuju posko pengungsian terdekat.
							</p>

							{/* Hero CTA Shortcuts */}
							<div className="mt-6 grid gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
								<button
									type="button"
									onClick={findNearest}
									disabled={locating}
									className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white shadow-md transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/60 disabled:cursor-wait disabled:opacity-80"
								>
									<LocateFixed className={`h-5 w-5 ${locating ? "animate-pulse" : ""}`} aria-hidden="true" />
									{locating ? "Mencari lokasi Anda..." : "Cari Posko Terdekat Saya"}
								</button>
								<div className="grid grid-cols-2 gap-2.5 sm:flex sm:gap-3">
									<button
										type="button"
										onClick={() => scrollToSection(mapSectionRef.current)}
										className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
									>
										<MapIcon className="h-4 w-4 text-blue-200" aria-hidden="true" />
										Buka Peta
									</button>
									<button
										type="button"
										onClick={() => scrollToSection(document.getElementById("daftar-posko"))}
										className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-blue-900 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
									>
										Daftar Posko ↓
									</button>
								</div>
							</div>

							<div aria-live="polite" className="mt-3 space-y-1 text-xs font-medium">
								{userLocation && !locationError && (
									<p className="flex items-start gap-1.5 text-emerald-300">
										<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
										<span>
											Lokasi Anda terdeteksi (akurasi ±{formatDistance(userLocation.accuracy / 1000)}). Daftar diurutkan dari yang terdekat.
											{userLocation.accuracy > 1000 && " Akurasi rendah: aktifkan GPS untuk hasil lebih tepat."}
										</span>
									</p>
								)}
								{locationError && (
									<p className="flex items-start gap-1.5 text-amber-300">
										<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
										<span>{locationError}</span>
									</p>
								)}
							</div>
						</div>

						{/* Guide Card */}
						<div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
							<p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-200">
								<Info className="h-4 w-4" aria-hidden="true" />
								Panduan Ketersediaan Ruang
							</p>
							<div className="mt-3 space-y-3 text-xs text-blue-50 sm:text-sm">
								<div className="flex items-start gap-2.5">
									<span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
									<p><strong className="text-white">Masih Tersedia (&lt;80%):</strong> Prioritas utama untuk pengungsi baru, daya tampung masih cukup.</p>
								</div>
								<div className="flex items-start gap-2.5">
									<span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
									<p><strong className="text-white">Kapasitas Terbatas (80-99%):</strong> Disarankan konfirmasi terlebih dahulu sebelum berangkat.</p>
								</div>
								<div className="flex items-start gap-2.5">
									<span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" />
									<p><strong className="text-white">Penuh (100%):</strong> Jangan menuju ke lokasi ini, arahkan ke posko alternatif lain.</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</header>

			<main id="konten-utama" aria-labelledby="public-heading" className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
				{error && (
					<div role="alert" className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
						<div className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
							<p>{error}</p>
						</div>
						<button
							type="button"
							onClick={() => void loadData("manual")}
							disabled={refreshing}
							className="min-h-10 rounded-lg bg-white px-4 font-bold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-60"
						>
							{refreshing ? "Mencoba..." : "Coba lagi"}
						</button>
					</div>
				)}

				{loading ? (
					<div role="status" className="flex min-h-96 flex-col items-center justify-center gap-3 text-sm text-slate-500">
						<RotateCw className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
						<p>Memuat informasi posko evakuasi terkini...</p>
					</div>
				) : (
					<>
						{/* Interactive KPI Cards */}
						{summary && (
							<section aria-label="Ringkasan statistik posko" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
								<button
									type="button"
									onClick={() => applyKpiFilter("ALL", "")}
									aria-pressed={filter === "ALL"}
									className={`rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${filter === "ALL" ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500" : "border-slate-200 bg-white"}`}
								>
									<div className="flex items-center justify-between text-slate-500">
										<p className="text-[11px] font-bold uppercase tracking-wide sm:text-xs">Posko Aktif</p>
										<MapPin className="h-4 w-4" aria-hidden="true" />
									</div>
									<p className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{summary.totalActiveCamps}</p>
									<p className="mt-1 text-xs font-semibold text-blue-700">Tampilkan semua</p>
								</button>

								<button
									type="button"
									onClick={() => applyKpiFilter("AVAILABLE", "yang masih tersedia")}
									aria-pressed={filter === "AVAILABLE"}
									className={`rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 ${filter === "AVAILABLE" ? "border-emerald-600 bg-emerald-100 ring-2 ring-emerald-500" : "border-emerald-200 bg-emerald-50"}`}
								>
									<div className="flex items-center justify-between text-emerald-700">
										<p className="text-[11px] font-bold uppercase tracking-wide sm:text-xs">Masih Tersedia</p>
										<CheckCircle2 className="h-4 w-4" aria-hidden="true" />
									</div>
									<p className="mt-2 text-2xl font-black text-emerald-800 sm:text-3xl">{summary.availableCamps}</p>
									<p className="mt-1 text-xs font-semibold text-emerald-700">{filter === "AVAILABLE" ? "Ketuk untuk reset" : "Saring posko ini"}</p>
								</button>

								<div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
									<div className="flex items-center justify-between text-blue-700">
										<p className="text-[11px] font-bold uppercase tracking-wide sm:text-xs">Ruang Tersisa</p>
										<Users className="h-4 w-4" aria-hidden="true" />
									</div>
									<p className="mt-2 text-2xl font-black text-blue-950 sm:text-3xl">{summary.totalAvailableCapacity.toLocaleString("id-ID")}</p>
									<p className="mt-1 text-xs text-blue-700">dari {summary.totalCapacity.toLocaleString("id-ID")} kapasitas</p>
								</div>

								<button
									type="button"
									onClick={() => applyKpiFilter("ATTENTION", "yang terbatas atau penuh")}
									aria-pressed={filter === "ATTENTION"}
									className={`rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/30 ${filter === "ATTENTION" ? "border-amber-600 bg-amber-100 ring-2 ring-amber-500" : "border-amber-200 bg-amber-50"}`}
								>
									<div className="flex items-center justify-between text-amber-700">
										<p className="text-[11px] font-bold uppercase tracking-wide sm:text-xs">Perlu Perhatian</p>
										<AlertTriangle className="h-4 w-4" aria-hidden="true" />
									</div>
									<p className="mt-2 text-2xl font-black text-amber-950 sm:text-3xl">{summary.limitedCamps + summary.fullCamps}</p>
									<p className="mt-1 text-xs font-semibold text-amber-800">
										{summary.limitedCamps} terbatas • {summary.fullCamps} penuh
									</p>
								</button>

								<div className="col-span-2 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
									<div>
										<div className="flex items-center justify-between text-slate-500">
											<p className="text-[11px] font-bold uppercase tracking-wide sm:text-xs">Pembaruan Data</p>
											<Clock className="h-4 w-4" aria-hidden="true" />
										</div>
										<p className="mt-2 text-sm font-bold text-slate-800">{lastUpdatedRelative ?? formatDate(summary.lastUpdatedAt)}</p>
										<p className="text-[11px] text-slate-500">Diperbarui otomatis tiap 1 menit</p>
									</div>
									<button
										type="button"
										onClick={() => void loadData("manual")}
										disabled={refreshing}
										className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
									>
										<RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`} aria-hidden="true" />
										{refreshing ? "Memperbarui..." : "Segarkan Data"}
									</button>
								</div>
							</section>
						)}

						{/* Nearest open camp suggestion */}
						{nearestCamp && (
							<section
								ref={nearestRef}
								tabIndex={-1}
								aria-label="Posko terdekat yang masih menerima"
								className="mt-6 scroll-mt-24 rounded-3xl border-2 border-emerald-500 bg-white p-5 shadow-md outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
							>
								<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
									<LocateFixed className="h-4 w-4" aria-hidden="true" />
									Posko terdekat yang masih menerima
								</p>
								<div className="mt-2 flex flex-wrap items-end justify-between gap-4">
									<div className="min-w-0">
										<h2 className="text-xl font-black text-slate-950">{nearestCamp.name}</h2>
										<p className="mt-0.5 text-sm text-slate-500">{nearestCamp.address}</p>
										<p className="mt-2 text-sm font-semibold">
											<span className="text-blue-700">± {formatDistance(nearestCamp.distance ?? 0)} (garis lurus)</span>
											<span className="text-slate-300"> • </span>
											<span className={capacityTextClass(nearestCamp.availability)}>
												{availabilityLabels[nearestCamp.availability]}, sisa {nearestCamp.availableCapacity} tempat
											</span>
										</p>
									</div>
									<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
										<a
											href={directionsUrl(nearestCamp)}
											target="_blank"
											rel="noreferrer"
											className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
										>
											<Navigation className="h-4 w-4" aria-hidden="true" />
											Rute ke Sini
										</a>
										<button
											type="button"
											onClick={() => showCampOnMap(nearestCamp.id)}
											className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
										>
											<MapPin className="h-4 w-4 text-blue-600" aria-hidden="true" />
											Lihat di Peta
										</button>
									</div>
								</div>
							</section>
						)}

						{/* Lokasi terdeteksi tetapi semua posko penuh */}
						{!nearestCamp && userLocation && camps.length > 0 && (
							<section
								ref={nearestRef}
								tabIndex={-1}
								role="alert"
								className="mt-6 flex scroll-mt-24 items-start gap-3 rounded-3xl border-2 border-rose-300 bg-rose-50 p-5 text-sm text-rose-900 outline-none"
							>
								<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
								<div>
									<p className="font-bold">Semua posko aktif saat ini penuh.</p>
									<p className="mt-1">
										Jangan berangkat tanpa konfirmasi. Hubungi <a href="tel:112" className="font-bold underline">112</a> atau petugas terdekat untuk arahan posko alternatif.
									</p>
								</div>
							</section>
						)}

						{/* Map & Selected Camp Section */}
						<section
							ref={mapSectionRef}
							id="peta-lokasi"
							aria-labelledby="map-heading"
							className="mt-10 grid scroll-mt-4 gap-5 lg:grid-cols-[1.35fr_0.65fr]"
						>
							<div className="min-w-0">
								<div className="flex flex-wrap items-end justify-between gap-3">
									<div>
										<p className="text-xs font-bold uppercase tracking-wider text-blue-700">Peta Interaktif</p>
										<h2 id="map-heading" className="mt-1 text-2xl font-black text-slate-950">
											Sebaran Lokasi Posko Evakuasi
										</h2>
									</div>
									<button
										type="button"
										onClick={centerOnUser}
										disabled={locating}
										className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
									>
										<LocateFixed className={`h-4 w-4 text-blue-600 ${locating ? "animate-pulse" : ""}`} aria-hidden="true" />
										{locating ? "Mencari lokasi..." : userLocation ? "Pusatkan ke Lokasi Saya" : "Tampilkan Lokasi Saya"}
									</button>
								</div>

								<div className="mt-4 h-[min(62dvh,440px)] min-h-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:h-[480px]">
									<CampMap
										camps={filteredCamps}
										activeId={visibleActiveCampId}
										onSelect={setActiveCampId}
										onDetail={openDetail}
										userLocation={userLocation}
										focusRequest={focusRequest}
										cooperativeGestures
									/>
								</div>
								<p className="mt-2 text-[11px] text-slate-500 sm:hidden">
									Geser peta dengan dua jari. Ketuk pin untuk melihat ringkasan posko.
								</p>

								<div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
									<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
										<span className="inline-flex items-center gap-1.5">
											<i aria-hidden="true" className="h-3 w-3 rounded-full bg-emerald-600" />
											Masih tersedia (&lt;80%)
										</span>
										<span className="inline-flex items-center gap-1.5">
											<i aria-hidden="true" className="h-3 w-3 rounded-full bg-amber-600" />
											Terbatas (80-99%)
										</span>
										<span className="inline-flex items-center gap-1.5">
											<i aria-hidden="true" className="h-3 w-3 rounded-full bg-rose-700" />
											Penuh (100%)
										</span>
										{userLocation && (
											<span className="inline-flex items-center gap-1.5 font-semibold text-blue-700">
												<i aria-hidden="true" className="h-3 w-3 rounded-full bg-blue-600 ring-2 ring-blue-200" />
												Lokasi Anda
											</span>
										)}
									</div>
									{hasActiveFilters && (
										<span className="font-semibold text-slate-500">
											Peta menampilkan {filteredCamps.length} posko sesuai filter
										</span>
									)}
								</div>
							</div>

							{/* Selected Camp Panel */}
							<aside aria-live="polite" aria-label="Posko terpilih" className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
								<div>
									<div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
										<p className="text-xs font-bold uppercase tracking-wider text-blue-700">Posko Terpilih</p>
										{selectedCamp && (
											<div className="flex items-center gap-2">
												<span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${availabilityClass(selectedCamp.availability)}`}>
													{availabilityLabels[selectedCamp.availability]}
												</span>
												<button
													type="button"
													onClick={() => setActiveCampId(null)}
													aria-label="Batalkan pilihan posko"
													className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
												>
													<X className="h-4 w-4" aria-hidden="true" />
												</button>
											</div>
										)}
									</div>

									{selectedCamp ? (
										<div className="mt-4">
											<h3 className="text-xl font-black text-slate-950">{selectedCamp.name}</h3>
											<p className="mt-1 text-sm leading-6 text-slate-500">{selectedCamp.address}</p>

											{typeof selectedCamp.distance === "number" && (
												<p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
													<Navigation className="h-3.5 w-3.5" aria-hidden="true" />
													± {formatDistance(selectedCamp.distance)} dari lokasi Anda
												</p>
											)}

											<div className="mt-4 rounded-2xl bg-slate-50 p-4">
												<div className="flex justify-between gap-2 text-xs font-semibold text-slate-600">
													<span>Terisi</span>
													<span className="font-bold text-slate-900">
														{selectedCamp.currentOccupants} / {selectedCamp.maxCapacity} jiwa ({selectedCamp.occupancyPercentage}%)
													</span>
												</div>
												<div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
													<div
														className={`h-full rounded-full ${availabilityBarClasses[selectedCamp.availability]}`}
														style={{ width: `${Math.min(selectedCamp.occupancyPercentage, 100)}%` }}
													/>
												</div>
												<p className={`mt-2 text-xs font-bold ${capacityTextClass(selectedCamp.availability)}`}>
													{selectedCamp.availableCapacity > 0
														? `${selectedCamp.availableCapacity} tempat masih tersisa`
														: "Tidak ada tempat tersisa"}
												</p>
												<p className="mt-1 text-xs text-slate-500">{availabilityDescription(selectedCamp)}</p>
											</div>

											{selectedCamp.facilities.length > 0 && (
												<div className="mt-4">
													<p className="text-xs font-bold uppercase tracking-wide text-slate-400">Kondisi Fasilitas</p>
													<div className="mt-2 flex flex-wrap gap-1.5">
														{selectedCamp.facilities.slice(0, 5).map((facility) => (
															<span
																key={facility.id}
																className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${statusBadgeClass(facility.status)}`}
															>
																<FacilityIcon name={facility.facilityName} />
																{facility.facilityName}: {statusLabels[facility.status] ?? facility.status}
															</span>
														))}
													</div>
												</div>
											)}
										</div>
									) : (
										<div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm leading-6 text-slate-500">
											<MapPin className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
											<p className="mt-2 font-semibold text-slate-700">Belum ada posko yang dipilih</p>
											<p className="mt-1 text-xs text-slate-500">
												Ketuk salah satu pin di peta atau tombol &quot;Lihat di Peta&quot; pada daftar posko.
											</p>
										</div>
									)}
								</div>

								{selectedCamp && (
									<div className="mt-6 grid gap-2 border-t border-slate-100 pt-4">
										<a
											href={directionsUrl(selectedCamp)}
											target="_blank"
											rel="noreferrer"
											className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-center text-sm font-bold text-white shadow-sm hover:bg-blue-700"
										>
											<Navigation className="h-4 w-4" aria-hidden="true" />
											Petunjuk Arah Google Maps ↗
										</a>
										<div className="grid grid-cols-2 gap-2">
											<button
												type="button"
												onClick={() => openDetail(selectedCamp.id)}
												className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
											>
												<Info className="h-4 w-4 text-blue-600" aria-hidden="true" />
												Rincian
											</button>
											<button
												type="button"
												onClick={() => void handleShareCamp(selectedCamp)}
												className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
											>
												{copiedCampId === selectedCamp.id ? (
													<Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
												) : (
													<Share2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
												)}
												{copiedCampId === selectedCamp.id ? "Tersalin" : "Bagikan"}
											</button>
										</div>
										<button
											type="button"
											onClick={() => scrollToCard(selectedCamp.id)}
											className="py-1 text-center text-xs font-semibold text-slate-500 hover:text-blue-600"
										>
											Lihat kartu posko di daftar ↓
										</button>
									</div>
								)}
							</aside>
						</section>

						{/* Camp List Section */}
						<section id="daftar-posko" aria-labelledby="camp-list-heading" className="mt-14 scroll-mt-4">
							<div className="flex flex-wrap items-end justify-between gap-4">
								<div>
									<p className="text-xs font-bold uppercase tracking-wider text-blue-600">Daftar Lokasi Terinci</p>
									<h2 id="camp-list-heading" className="mt-1 text-2xl font-black text-slate-950">
										Pilih Posko Evakuasi
									</h2>
									<p className="mt-1 text-sm text-slate-500">Data diperbarui langsung oleh petugas posko di lapangan.</p>
								</div>
								<p role="status" aria-live="polite" className="text-sm font-semibold text-slate-700">
									Menampilkan <strong className="text-blue-600">{filteredCamps.length}</strong> dari {camps.length} posko
								</p>
							</div>

							{/* Toolbar & Filters (menempel di atas saat digulir) */}
							<div className="sticky top-0 z-20 -mx-4 mt-5 border-y border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:p-4 sm:shadow-sm">
								<div className="grid gap-2.5 md:grid-cols-[1fr_auto] md:gap-3">
									<div className="relative">
										<label htmlFor="camp-search" className="sr-only">Cari posko</label>
										<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
										<input
											ref={searchInputRef}
											id="camp-search"
											type="search"
											inputMode="search"
											enterKeyHint="search"
											autoComplete="off"
											aria-describedby="camp-search-help"
											value={query}
											onChange={(event) => setQuery(event.target.value)}
											onKeyDown={(event) => {
												if (event.key === "Escape" && query) {
													event.preventDefault();
													setQuery("");
												}
												if (event.key === "Enter") event.currentTarget.blur();
											}}
											placeholder="Cari nama posko, desa, atau jalan..."
											className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-base outline-none [&::-webkit-search-cancel-button]:hidden focus:border-blue-700 focus:ring-4 focus:ring-blue-500/20 sm:text-sm"
										/>
										{query && (
											<button
												type="button"
												onClick={() => {
													setQuery("");
													searchInputRef.current?.focus();
												}}
												aria-label="Hapus pencarian"
												className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
											>
												<X className="h-5 w-5" aria-hidden="true" />
											</button>
										)}
										<span id="camp-search-help" className="sr-only">
											Ketik nama posko atau alamat untuk menyaring daftar dan peta. Tekan garis miring untuk langsung ke kolom ini.
										</span>
									</div>

									<div className="flex items-center gap-2">
										<label htmlFor="camp-sort" className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500">Urutkan</label>
										<select
											id="camp-sort"
											value={effectiveSort}
											onChange={(event) => {
												const next = event.target.value as CampSort;
												if (next === "DISTANCE" && !userLocation) {
													requestLocation();
													return;
												}
												setSort(next);
											}}
											className="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 sm:text-sm md:w-auto"
										>
											<option value="AVAILABILITY">Tempat tersisa terbanyak</option>
											<option value="DISTANCE">{userLocation ? "Paling dekat dari saya" : "📍 Paling dekat (izinkan lokasi)"}</option>
											<option value="OCCUPANCY">Okupansi terendah</option>
											<option value="NAME">Nama posko (A–Z)</option>
										</select>
									</div>
								</div>

								{/* 1-Tap Quick Filter Pills */}
								<div role="group" aria-label="Saring berdasarkan status ketersediaan" className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
									{filterOptions.map((option) => (
										<button
											key={option.value}
											type="button"
											onClick={() => setFilter(option.value)}
											aria-pressed={filter === option.value}
											className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${filter === option.value ? `${option.active} shadow-sm` : option.idle}`}
										>
											{option.dot && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${filter === option.value ? "bg-white" : option.dot}`} />}
											{option.label} ({filterCounts[option.value]})
										</button>
									))}
									{hasActiveFilters && (
										<button
											type="button"
											onClick={resetFilters}
											className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold text-blue-700 hover:bg-blue-50"
										>
											<X className="h-3.5 w-3.5" aria-hidden="true" />
											Reset
										</button>
									)}
								</div>
							</div>

							{/* Camp Cards Grid */}
							{filteredCamps.length === 0 ? (
								<div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
									<MapPin className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
									<p className="mt-3 text-lg font-bold text-slate-900">
										{camps.length > 0 ? "Posko tidak ditemukan" : error ? "Data posko belum dapat dimuat" : "Belum ada posko aktif"}
									</p>
									<p className="mt-1 text-sm text-slate-500">
										{camps.length > 0
											? "Tidak ada posko yang cocok dengan filter atau kata kunci pencarian Anda."
											: error
												? "Periksa koneksi internet lalu tekan \"Coba lagi\". Untuk bantuan darurat, hubungi 112."
												: "Saat ini belum ada posko evakuasi aktif yang tercatat. Hubungi 112 untuk bantuan darurat."}
									</p>
									{hasActiveFilters && (
										<button
											type="button"
											onClick={resetFilters}
											className="mt-4 min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
										>
											Reset pencarian & filter
										</button>
									)}
								</div>
							) : (
								<ul className="mt-6 grid gap-4 sm:gap-5 xl:grid-cols-2">
									{filteredCamps.map((camp) => {
										const neededLogistics = camp.logistics.filter((item) => item.status !== "SUFFICIENT");
										const updated = now > 0 ? formatRelativeTime(camp.lastUpdatedAt, now) : null;
										return (
											<li key={camp.id}>
												<article
													ref={(element) => {
														cardRefs.current[camp.id] = element;
													}}
													tabIndex={-1}
													aria-labelledby={`camp-${camp.id}-name`}
													className={`flex h-full scroll-mt-40 flex-col justify-between rounded-3xl border bg-white p-4 shadow-sm outline-none transition hover:shadow-md sm:p-5 ${visibleActiveCampId === camp.id ? "border-blue-500 ring-4 ring-blue-500/15" : "border-slate-200"
														}`}
												>
													<div>
														<div className="flex items-start justify-between gap-3">
															<div className="min-w-0">
																<h3 id={`camp-${camp.id}-name`} className="text-lg font-black leading-snug text-slate-950">{camp.name}</h3>
																<p className="mt-1 text-sm leading-5 text-slate-500">
																	{camp.address}
																	{typeof camp.distance === "number" && (
																		<span className="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700">
																			<Navigation className="h-3 w-3" aria-hidden="true" />
																			{formatDistance(camp.distance)}
																		</span>
																	)}
																</p>
															</div>
															<span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${availabilityClass(camp.availability)}`}>
																{availabilityLabels[camp.availability]}
															</span>
														</div>

														<div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
															<div className="flex justify-between gap-2 text-xs font-semibold text-slate-700">
																<span>
																	Terisi <strong>{camp.currentOccupants}</strong> / {camp.maxCapacity} jiwa
																</span>
																<span className="font-bold text-slate-900">{camp.occupancyPercentage}%</span>
															</div>
															<div
																role="meter"
																aria-label={`Okupansi ${camp.name}`}
																aria-valuemin={0}
																aria-valuemax={100}
																aria-valuenow={Math.min(camp.occupancyPercentage, 100)}
																className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"
															>
																<div
																	className={`h-full rounded-full ${availabilityBarClasses[camp.availability]}`}
																	style={{ width: `${Math.min(camp.occupancyPercentage, 100)}%` }}
																/>
															</div>
															<p className={`mt-2 text-xs font-bold ${capacityTextClass(camp.availability)}`}>
																{camp.availableCapacity > 0 ? `${camp.availableCapacity} tempat tersisa` : "Tidak ada tempat tersisa"}
																<span className="font-normal text-slate-500"> — {availabilityDescription(camp)}</span>
															</p>
														</div>

														<div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
															{camp.facilities.length > 0 && (
																<div>
																	<p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fasilitas</p>
																	<div className="mt-1.5 flex flex-wrap gap-1.5">
																		{camp.facilities.slice(0, 5).map((facility) => (
																			<span
																				key={facility.id}
																				className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${statusBadgeClass(facility.status)}`}
																			>
																				<FacilityIcon name={facility.facilityName} />
																				<span>{facility.facilityName}</span>
																				<span className="opacity-75">({statusLabels[facility.status] ?? facility.status})</span>
																			</span>
																		))}
																	</div>
																</div>
															)}

															{neededLogistics.length > 0 && (
																<div>
																	<p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Butuh Bantuan Logistik</p>
																	<div className="mt-1.5 flex flex-wrap gap-1.5">
																		{neededLogistics.slice(0, 3).map((item) => (
																			<span
																				key={item.id}
																				className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold ${statusBadgeClass(item.status)}`}
																			>
																				<Package className="h-3 w-3" aria-hidden="true" />
																				{item.itemName}: {statusLabels[item.status] ?? item.status}
																			</span>
																		))}
																		{neededLogistics.length > 3 && (
																			<button
																				type="button"
																				onClick={() => openDetail(camp.id, "LOGISTICS")}
																				className="rounded-lg px-2 py-0.5 text-xs font-bold text-rose-700 underline-offset-2 hover:underline"
																			>
																				+{neededLogistics.length - 3} lainnya
																			</button>
																		)}
																	</div>
																</div>
															)}
														</div>
													</div>

													<div className="mt-5 border-t border-slate-100 pt-4">
														<p className="text-[11px] text-slate-500" title={formatDate(camp.lastUpdatedAt)}>
															Diperbarui {updated ?? formatDate(camp.lastUpdatedAt)}
														</p>
														<div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
															<a
																href={directionsUrl(camp)}
																target="_blank"
																rel="noreferrer"
																aria-label={`Petunjuk arah ke ${camp.name} (Google Maps)`}
																className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:order-last sm:col-span-1 sm:min-h-10 sm:text-xs"
															>
																<Navigation className="h-4 w-4" aria-hidden="true" />
																Petunjuk Arah ↗
															</a>
															<button
																type="button"
																onClick={() => showCampOnMap(camp.id)}
																className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 sm:min-h-10 sm:text-xs"
															>
																<MapPin className="h-4 w-4" aria-hidden="true" />
																Lihat di Peta
															</button>
															<button
																type="button"
																onClick={() => openDetail(camp.id)}
																className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:min-h-10 sm:text-xs"
															>
																<Info className="h-4 w-4" aria-hidden="true" />
																Rincian
															</button>
															<button
																type="button"
																onClick={() => void handleShareCamp(camp)}
																aria-label={`Bagikan informasi ${camp.name}`}
																className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 sm:col-span-1 sm:min-h-10 sm:text-xs"
															>
																{copiedCampId === camp.id ? (
																	<>
																		<Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
																		<span className="text-emerald-700">Tersalin</span>
																	</>
																) : (
																	<>
																		<Share2 className="h-4 w-4" aria-hidden="true" />
																		Bagikan
																	</>
																)}
															</button>
														</div>
													</div>
												</article>
											</li>
										);
									})}
								</ul>
							)}
						</section>
					</>
				)}
			</main>

			{/* Modal Detail Posko */}
			<Modal isOpen={Boolean(modalCamp)} onClose={() => setModalCampId(null)} title={modalCamp ? modalCamp.name : "Detail posko"}>
				{modalCamp && (
					<div className="space-y-4 text-sm">
						<div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600">
							<p className="font-semibold text-slate-900">{modalCamp.address}</p>
							<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
								<span className={`rounded-full px-2.5 py-0.5 font-bold ring-1 ${availabilityClass(modalCamp.availability)}`}>
									{availabilityLabels[modalCamp.availability]}
								</span>
								<span>
									Terisi <strong>{modalCamp.currentOccupants}</strong> / {modalCamp.maxCapacity} jiwa ({modalCamp.occupancyPercentage}%)
								</span>
								{typeof modalCamp.distance === "number" && (
									<span className="font-semibold text-blue-700">± {formatDistance(modalCamp.distance)} dari Anda</span>
								)}
							</div>
							<p className={`mt-2 font-bold ${capacityTextClass(modalCamp.availability)}`}>
								{modalCamp.availableCapacity > 0 ? `${modalCamp.availableCapacity} tempat tersisa` : "Tidak ada tempat tersisa"}
							</p>
							<p className="mt-1 text-[11px] text-slate-500">Diperbarui {formatDate(modalCamp.lastUpdatedAt)}</p>
						</div>

						<div role="tablist" aria-label="Rincian posko" onKeyDown={onModalTabKeyDown} className="grid grid-cols-2 border-b border-slate-200">
							{([
								["FACILITIES", `Fasilitas (${modalCamp.facilities.length})`],
								["LOGISTICS", `Logistik (${modalCamp.logistics.length})`],
							] as const).map(([tab, label]) => (
								<button
									key={tab}
									type="button"
									role="tab"
									id={`modal-tab-${tab}`}
									data-tab={tab}
									aria-selected={modalTab === tab}
									aria-controls={modalTab === tab ? `modal-panel-${tab}` : undefined}
									tabIndex={modalTab === tab ? 0 : -1}
									onClick={() => setModalTab(tab)}
									className={`min-h-11 border-b-2 px-3 text-xs font-bold transition sm:text-sm ${modalTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
								>
									{label}
								</button>
							))}
						</div>

						<div
							role="tabpanel"
							id={`modal-panel-${modalTab}`}
							aria-labelledby={`modal-tab-${modalTab}`}
							className="space-y-2"
						>
							{modalTab === "FACILITIES" ? (
								modalCamp.facilities.length === 0 ? (
									<p className="py-4 text-center text-xs text-slate-500">Belum ada data fasilitas yang dicatat.</p>
								) : (
									modalCamp.facilities.map((facility) => (
										<div key={facility.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
											<div className="flex min-w-0 items-center gap-2.5">
												<div className="rounded-lg bg-blue-50 p-2 text-blue-700">
													<FacilityIcon name={facility.facilityName} className="h-4 w-4" />
												</div>
												<p className="text-xs font-bold text-slate-900 sm:text-sm">{facility.facilityName}</p>
											</div>
											<span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClass(facility.status)}`}>
												{statusLabels[facility.status] ?? facility.status}
											</span>
										</div>
									))
								)
							) : modalCamp.logistics.length === 0 ? (
								<p className="py-4 text-center text-xs text-slate-500">Belum ada data stok logistik yang dicatat.</p>
							) : (
								[...modalCamp.logistics]
									.sort((first, second) => Number(first.status === "SUFFICIENT") - Number(second.status === "SUFFICIENT"))
									.map((item) => (
										<div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
											<div className="flex min-w-0 items-center gap-2.5">
												<div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
													<Package className="h-4 w-4" aria-hidden="true" />
												</div>
												<p className="text-xs font-bold text-slate-900 sm:text-sm">{item.itemName}</p>
											</div>
											<span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClass(item.status)}`}>
												{statusLabels[item.status] ?? item.status}
											</span>
										</div>
									))
							)}
						</div>

						<div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white px-4 pt-3 pb-1 sm:-mx-6 sm:px-6">
							<a
								href={directionsUrl(modalCamp)}
								target="_blank"
								rel="noreferrer"
								className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
							>
								<Navigation className="h-4 w-4" aria-hidden="true" />
								Buka Navigasi Maps ↗
							</a>
							<button
								type="button"
								onClick={() => handleWhatsAppCamp(modalCamp)}
								className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700"
							>
								<MessageCircle className="h-4 w-4" aria-hidden="true" />
								WhatsApp
							</button>
							<button
								type="button"
								onClick={() => void handleCopyCamp(modalCamp)}
								className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
							>
								{copiedCampId === modalCamp.id ? (
									<Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
								) : (
									<Copy className="h-4 w-4" aria-hidden="true" />
								)}
								{copiedCampId === modalCamp.id ? "Tersalin" : "Salin Info"}
							</button>
							<button
								type="button"
								onClick={() => showCampOnMap(modalCamp.id)}
								className="col-span-2 min-h-10 text-xs font-semibold text-slate-500 hover:text-blue-600"
							>
								Tampilkan di peta
							</button>
						</div>
					</div>
				)}
			</Modal>

			{/* Toast */}
			<div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 sm:bottom-6">
				{toast && (
					<p key={toast.id} className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xl">
						{toast.message}
					</p>
				)}
			</div>

			{/* Back to top (tablet & desktop) */}
			{showBackToTop && (
				<button
					type="button"
					onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
					aria-label="Kembali ke atas"
					className="fixed bottom-6 right-6 z-30 hidden h-12 w-12 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 sm:flex"
				>
					<ArrowUp className="h-5 w-5" aria-hidden="true" />
				</button>
			)}

			{/* Mobile quick-action bar */}
			<nav
				aria-label="Aksi cepat"
				className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
			>
				<div className="grid grid-cols-4">
					<a href="tel:112" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-rose-700 active:bg-rose-50">
						<PhoneCall className="h-5 w-5" aria-hidden="true" />
						Telepon 112
					</a>
					<button
						type="button"
						onClick={findNearest}
						disabled={locating}
						className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-emerald-700 active:bg-emerald-50 disabled:opacity-60"
					>
						<LocateFixed className={`h-5 w-5 ${locating ? "animate-pulse" : ""}`} aria-hidden="true" />
						{locating ? "Mencari..." : "Terdekat"}
					</button>
					<button
						type="button"
						onClick={() => scrollToSection(mapSectionRef.current)}
						className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-blue-700 active:bg-blue-50"
					>
						<MapIcon className="h-5 w-5" aria-hidden="true" />
						Peta
					</button>
					<button
						type="button"
						onClick={() => {
							// Fokus harus sinkron di dalam gesture agar keyboard iOS/Android ikut terbuka.
							searchInputRef.current?.focus({ preventScroll: true });
							scrollToSection(document.getElementById("daftar-posko"));
						}}
						className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-700 active:bg-slate-100"
					>
						<Search className="h-5 w-5" aria-hidden="true" />
						Cari Posko
					</button>
				</div>
			</nav>

			{/* Footer */}
			<footer className="border-t border-slate-200 bg-white">
				<div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 text-sm text-slate-600 sm:px-8 md:flex-row md:items-start md:justify-between">
					<div className="max-w-2xl space-y-2">
						<p className="font-semibold text-slate-800">Pusat Informasi Posko Bencana & Evakuasi Terpadu</p>
						<p className="text-xs leading-5 text-slate-500">
							Informasi ini diperbarui berkala oleh petugas posko lapangan untuk memudahkan masyarakat dan relawan.
							Jarak yang ditampilkan adalah garis lurus; gunakan petunjuk arah untuk rute jalan sebenarnya.
							Dalam keadaan darurat, segera hubungi Call Center 112.
						</p>
						<p className="text-xs text-slate-400">© {new Date().getFullYear()} Fourkeys Technology. Seluruh hak cipta dilindungi.</p>
					</div>
					<div className="space-y-2 md:max-w-xs md:text-right">
						<p className="font-bold text-slate-900">Akses Khusus Petugas Posko</p>
						<p className="text-xs leading-5 text-slate-500">
							Petugas BPBD, Tagana, relawan PMI, dan manager posko dapat masuk untuk mencatat pengungsi dan stok logistik.
						</p>
						<Link
							href={user ? "/dashboard" : "/login"}
							className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 hover:underline focus-visible:ring-4 focus-visible:ring-blue-500/30"
						>
							{user ? "Buka Dashboard Petugas →" : "Masuk ke Dashboard Petugas →"}
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
