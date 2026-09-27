"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { occupancyColor } from "@/lib/occupancy";

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
};

function createIcon(color: string) {
	return L.divIcon({
		className: "",
		html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
		iconSize: [18, 18],
		iconAnchor: [9, 18],
		popupAnchor: [0, -16],
	});
}

function escapeHtml(value: string) {
	return value.replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] ?? character);
}

export function CampMap({
	camps,
	activeId,
	onSelect,
	popupExtra,
}: {
	camps: MapCamp[];
	activeId?: string | null;
	onSelect?: (id: string) => void;
	popupExtra?: (camp: MapCamp) => string;
}) {
	const mapRef = useRef<L.Map | null>(null);
	const layerRef = useRef<L.LayerGroup | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const markersRef = useRef<Record<string, L.Marker>>({});
	const onSelectRef = useRef(onSelect);
	const popupExtraRef = useRef(popupExtra);

	useEffect(() => {
		onSelectRef.current = onSelect;
	}, [onSelect]);

	useEffect(() => {
		popupExtraRef.current = popupExtra;
	}, [popupExtra]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || mapRef.current) return;

		const map = L.map(container, { scrollWheelZoom: false, keyboard: true });
		const layer = L.layerGroup().addTo(map);

		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(map);

		map.setView([-7.47, 112.69], 11);
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
			map.remove();
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		const layer = layerRef.current;
		if (!map || !layer || !containerRef.current?.isConnected) return;

		layer.clearLayers();
		markersRef.current = {};
		containerRef.current?.setAttribute("role", "region");
		containerRef.current?.setAttribute("aria-label", "Peta lokasi posko evakuasi. Gunakan daftar posko sebagai alternatif navigasi.");

		camps.forEach((camp) => {
			if (!mapRef.current || !layerRef.current) return;

			const color = occupancyColor(camp.occupancyPercentage);
			const marker = L.marker([camp.latitude, camp.longitude], {
				icon: createIcon(color),
			});

			marker.bindPopup(`
				<div style="min-width:200px">
					<strong>${escapeHtml(camp.name)}</strong>
					<p style="margin:4px 0;color:#555">${escapeHtml(camp.address)}</p>
					<p style="margin:4px 0">
						Okupansi: ${camp.currentOccupants}/${camp.maxCapacity}
						(${camp.occupancyPercentage}%)
					</p>
					${popupExtraRef.current?.(camp) ?? ""}
					<p style="margin:4px 0;color:${color};font-weight:600">
						${escapeHtml(camp.status)}
					</p>
				</div>
			`);

			marker.options.title = `${camp.name}. Okupansi ${camp.occupancyPercentage} persen.`;
			marker.on("click", () => {
				if (mapRef.current === map) onSelectRef.current?.(camp.id);
			});
			marker.addTo(layer);
			if (mapRef.current !== map || layerRef.current !== layer) {
				marker.remove();
				return;
			}

			markersRef.current[camp.id] = marker;
		});

		if (camps.length > 0 && mapRef.current === map) {
			const bounds = L.latLngBounds(
				camps.map((camp) => [camp.latitude, camp.longitude] as [number, number]),
			);
			map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
		}
	}, [camps]);

	useEffect(() => {
		const map = mapRef.current;
		const marker = activeId ? markersRef.current[activeId] : null;
		if (
			!map ||
			!marker ||
			!containerRef.current?.isConnected ||
			!marker.getElement()
		) {
			return;
		}

		marker.openPopup();
		map.panTo(marker.getLatLng());
	}, [activeId, camps]);

	return <div ref={containerRef} className="h-full w-full" />;
}
