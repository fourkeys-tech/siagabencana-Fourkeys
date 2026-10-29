"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { occupancyColor } from "@/lib/occupancy";
import { availabilityColors, directionsUrl, formatDistance } from "@/lib/public-camps";

export type MapCamp = {
	id: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	currentOccupants: number;
	occupancyPercentage: number;
	status: string;
	availability?: "AVAILABLE" | "LIMITED" | "FULL";
	distance?: number;
};

type LatLng = { latitude: number; longitude: number };

function createIcon(color: string, active: boolean) {
	const size = active ? 28 : 22;
	return L.divIcon({
		className: "",
		html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:${active ? 3 : 2}px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45)"></div>`,
		iconSize: [size, size],
		iconAnchor: [size / 2, size],
		popupAnchor: [0, -size + 2],
	});
}

function createUserLocationIcon() {
	return L.divIcon({
		className: "",
		html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
			<div style="position:absolute;width:34px;height:34px;border-radius:50%;background:#3b82f6;opacity:0.3;"></div>
			<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>
		</div>`,
		iconSize: [22, 22],
		iconAnchor: [11, 11],
		popupAnchor: [0, -14],
	});
}

function escapeHtml(value: string) {
	return value.replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] ?? character);
}

function campColor(camp: MapCamp) {
	return camp.availability ? availabilityColors[camp.availability] : occupancyColor(camp.occupancyPercentage);
}

export function CampMap({
	camps,
	activeId,
	onSelect,
	onDetail,
	popupExtra,
	userLocation,
	focusRequest,
	cooperativeGestures = false,
}: {
	camps: MapCamp[];
	activeId?: string | null;
	onSelect?: (id: string) => void;
	/** Menampilkan tombol "Rincian" di popup marker. */
	onDetail?: (id: string) => void;
	popupExtra?: (camp: MapCamp) => string;
	userLocation?: LatLng | null;
	/** Ubah `key` untuk memusatkan peta ke titik tertentu (mis. lokasi pengguna); `campId` ikut membuka popup-nya. */
	focusRequest?: (LatLng & { key: number; campId?: string }) | null;
	/** Di perangkat sentuh: satu jari menggulir halaman, dua jari menggeser/zoom peta. */
	cooperativeGestures?: boolean;
}) {
	const mapRef = useRef<L.Map | null>(null);
	const layerRef = useRef<L.LayerGroup | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const markersRef = useRef<Record<string, L.Marker>>({});
	const onSelectRef = useRef(onSelect);
	const onDetailRef = useRef(onDetail);
	const popupExtraRef = useRef(popupExtra);
	const activeIdRef = useRef(activeId);
	const lastFitKeyRef = useRef<string | null>(null);
	const lastFocusedIdRef = useRef<string | null>(null);
	const [showGestureHint, setShowGestureHint] = useState(false);

	useEffect(() => {
		onSelectRef.current = onSelect;
		onDetailRef.current = onDetail;
		popupExtraRef.current = popupExtra;
		activeIdRef.current = activeId;
	}, [onSelect, onDetail, popupExtra, activeId]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || mapRef.current) return;

		const map = L.map(container, { scrollWheelZoom: false, keyboard: true, tapTolerance: 20 });
		const layer = L.layerGroup().addTo(map);

		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(map);

		map.setView([-7.47, 112.69], 11);
		// Scroll roda hanya aktif setelah peta difokus/diklik, agar halaman tetap bisa digulir.
		map.on("focus click", () => map.scrollWheelZoom.enable());
		map.on("blur mouseout", () => map.scrollWheelZoom.disable());
		mapRef.current = map;
		layerRef.current = layer;

		const resizeObserver = new ResizeObserver(() => {
			if (mapRef.current !== map || !container.isConnected) return;
			map.invalidateSize({ pan: false });
		});
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
			layer.clearLayers();
			markersRef.current = {};
			layerRef.current = null;
			mapRef.current = null;
			lastFitKeyRef.current = null;
			lastFocusedIdRef.current = null;
			map.remove();
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		const container = containerRef.current;
		if (!map || !container) return;

		const restrict = cooperativeGestures && window.matchMedia("(pointer: coarse)").matches;
		if (restrict) map.dragging.disable();
		else map.dragging.enable();
		if (!restrict) return;

		let timer = 0;
		let start: { x: number; y: number } | null = null;
		const onTouchStart = (event: TouchEvent) => {
			start = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
		};
		const onTouchMove = (event: TouchEvent) => {
			if (event.touches.length > 1) {
				window.clearTimeout(timer);
				setShowGestureHint(false);
				return;
			}
			const touch = event.touches[0];
			// Abaikan getaran kecil saat mengetuk pin.
			if (!start || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) < 12) return;
			window.clearTimeout(timer);
			setShowGestureHint(true);
			timer = window.setTimeout(() => setShowGestureHint(false), 1600);
		};
		container.addEventListener("touchstart", onTouchStart, { passive: true });
		container.addEventListener("touchmove", onTouchMove, { passive: true });
		return () => {
			window.clearTimeout(timer);
			container.removeEventListener("touchstart", onTouchStart);
			container.removeEventListener("touchmove", onTouchMove);
		};
	}, [cooperativeGestures]);

	useEffect(() => {
		const map = mapRef.current;
		const layer = layerRef.current;
		const container = containerRef.current;
		if (!map || !layer || !container?.isConnected) return;

		const reopenActive = activeIdRef.current ? markersRef.current[activeIdRef.current]?.isPopupOpen() ?? false : false;
		layer.clearLayers();
		markersRef.current = {};
		container.setAttribute("role", "region");
		container.setAttribute("aria-label", "Peta lokasi posko evakuasi. Gunakan daftar posko sebagai alternatif navigasi.");

		if (userLocation) {
			const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
				icon: createUserLocationIcon(),
				zIndexOffset: 1000,
				title: "Lokasi Anda saat ini",
			});
			userMarker.bindPopup(`
				<div style="min-width:160px;text-align:center;padding:4px;">
					<strong style="color:#2563eb;font-size:13px;">📍 Lokasi Anda</strong>
					<p style="margin:4px 0 0 0;font-size:11px;color:#64748b;">Perkiraan lokasi GPS perangkat Anda</p>
				</div>
			`);
			userMarker.addTo(layer);
		}

		camps.forEach((camp) => {
			const color = campColor(camp);
			const marker = L.marker([camp.latitude, camp.longitude], {
				icon: createIcon(color, camp.id === activeIdRef.current),
				title: `${camp.name}. Okupansi ${camp.occupancyPercentage} persen.`,
				riseOnHover: true,
			});

			const distanceHtml = typeof camp.distance === "number"
				? `<p style="margin:4px 0 0;font-size:12px;font-weight:700;color:#2563eb;">📍 ${formatDistance(camp.distance)} dari lokasi Anda</p>`
				: "";
			const detailButton = onDetailRef.current
				? `<button type="button" data-camp-detail style="flex:1;min-height:36px;font-size:12px;font-weight:700;background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;">Rincian</button>`
				: "";

			const content = document.createElement("div");
			content.style.minWidth = "200px";
			content.innerHTML = `
				<strong style="font-size:14px;color:#0f172a;">${escapeHtml(camp.name)}</strong>
				<p style="margin:4px 0;font-size:12px;color:#64748b;">${escapeHtml(camp.address)}</p>
				${distanceHtml}
				<div style="margin:8px 0 6px 0;background:#f1f5f9;border-radius:6px;padding:6px 8px;font-size:12px;">
					<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;">
						<span>Terisi</span>
						<strong>${camp.currentOccupants}/${camp.maxCapacity} (${camp.occupancyPercentage}%)</strong>
					</div>
					<div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
						<div style="width:${Math.min(camp.occupancyPercentage, 100)}%;height:100%;background:${color};border-radius:3px;"></div>
					</div>
				</div>
				${popupExtraRef.current?.(camp) ?? ""}
				<div style="margin-top:8px;display:flex;gap:6px;">
					${detailButton}
					<a href="${directionsUrl(camp)}" target="_blank" rel="noreferrer" style="flex:1;display:inline-flex;align-items:center;justify-content:center;min-height:36px;font-size:12px;font-weight:700;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;">Rute Maps ↗</a>
				</div>
			`;
			content.querySelector("[data-camp-detail]")?.addEventListener("click", () => onDetailRef.current?.(camp.id));

			marker.bindPopup(content, { maxWidth: 280, autoPanPadding: [16, 16] });
			marker.on("click", () => {
				if (mapRef.current === map) onSelectRef.current?.(camp.id);
			});
			marker.addTo(layer);
			markersRef.current[camp.id] = marker;
		});

		// Refit hanya saat himpunan posko / lokasi pengguna berubah, bukan setiap auto-refresh data.
		const fitKey = [
			camps.map((camp) => camp.id).sort().join(","),
			userLocation ? `${userLocation.latitude.toFixed(4)},${userLocation.longitude.toFixed(4)}` : "",
		].join("|");
		if (fitKey !== lastFitKeyRef.current) {
			lastFitKeyRef.current = fitKey;
			const points: [number, number][] = camps.map((camp) => [camp.latitude, camp.longitude]);
			if (userLocation) points.push([userLocation.latitude, userLocation.longitude]);
			if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
		}

		if (reopenActive && activeIdRef.current) {
			markersRef.current[activeIdRef.current]?.openPopup();
		}
	}, [camps, userLocation]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		Object.entries(markersRef.current).forEach(([id, marker]) => {
			const camp = camps.find((item) => item.id === id);
			if (!camp) return;
			marker.setIcon(createIcon(campColor(camp), id === activeId));
			marker.setZIndexOffset(id === activeId ? 500 : 0);
		});

		if (!activeId) {
			// Tutup popup hanya saat pilihan dibatalkan, bukan setiap data diperbarui.
			if (lastFocusedIdRef.current) map.closePopup();
			lastFocusedIdRef.current = null;
			return;
		}
		if (lastFocusedIdRef.current === activeId) return;

		const marker = markersRef.current[activeId];
		if (!marker || !containerRef.current?.isConnected) return;
		lastFocusedIdRef.current = activeId;
		map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
		marker.openPopup();
	}, [activeId, camps]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !focusRequest) return;
		map.setView([focusRequest.latitude, focusRequest.longitude], Math.max(map.getZoom(), 14));
		if (focusRequest.campId) markersRef.current[focusRequest.campId]?.openPopup();
	}, [focusRequest]);

	return (
		<div className="relative isolate h-full w-full">
			<div ref={containerRef} className="h-full w-full" />
			{showGestureHint && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-6 text-center text-sm font-bold text-white"
				>
					Gunakan dua jari untuk menggeser &amp; memperbesar peta
				</div>
			)}
		</div>
	);
}
