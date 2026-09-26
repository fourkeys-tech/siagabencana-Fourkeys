"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapCamp = {
	id: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	maxCapacity: number;
	currentOccupants: number;
	occupancyPercentage: number;
	status: string;
};

function occupancyColor(percentage: number) {
	if (percentage >= 90) return "#dc2626";
	if (percentage >= 70) return "#f59e0b";
	return "#16a34a";
}

function createIcon(color: string) {
	return L.divIcon({
		className: "",
		html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
		iconSize: [18, 18],
		iconAnchor: [9, 18],
		popupAnchor: [0, -16],
	});
}

export function CampMap({
	camps,
	activeId,
	onSelect,
}: {
	camps: MapCamp[];
	activeId?: string | null;
	onSelect?: (id: string) => void;
}) {
	const mapRef = useRef<L.Map | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const markersRef = useRef<Record<string, L.Marker>>({});

	useEffect(() => {
		if (!containerRef.current || mapRef.current) return;

		const map = L.map(containerRef.current, {
			scrollWheelZoom: true,
		});

		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(map);

		map.setView([-7.47, 112.69], 11);

		mapRef.current = map;

		return () => {
			map.remove();
			mapRef.current = null;
			markersRef.current = {};
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		Object.values(markersRef.current).forEach((marker) =>
			marker.remove(),
		);
		markersRef.current = {};

		camps.forEach((camp) => {
			const color = occupancyColor(camp.occupancyPercentage);

			const marker = L.marker([camp.latitude, camp.longitude], {
				icon: createIcon(color),
			}).addTo(map);

			marker.bindPopup(`
				<div style="min-width:200px">
					<strong>${camp.name}</strong>
					<p style="margin:4px 0;color:#555">${camp.address}</p>
					<p style="margin:4px 0">
						Okupansi: ${camp.currentOccupants}/${camp.maxCapacity}
						(${camp.occupancyPercentage}%)
					</p>
					<p style="margin:4px 0;color:${color};font-weight:600">
						${camp.status}
					</p>
				</div>
			`);

			marker.on("click", () => {
				onSelect?.(camp.id);
			});

			markersRef.current[camp.id] = marker;
		});

		if (camps.length > 0) {
			const bounds = L.latLngBounds(
				camps.map((camp) => [camp.latitude, camp.longitude] as [
					number,
					number,
				]),
			);
			map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
		}
	}, [camps, onSelect]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !activeId) return;

		const marker = markersRef.current[activeId];
		if (marker) {
			marker.openPopup();
			map.panTo(marker.getLatLng());
		}
	}, [activeId]);

	return <div ref={containerRef} className="h-full w-full" />;
}
