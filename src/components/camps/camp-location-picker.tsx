"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type CampLocation = {
	latitude: number;
	longitude: number;
};

const defaultCenter: [number, number] = [-7.47, 112.69];

export function CampLocationPicker({
	value,
	onChange,
}: {
	value: CampLocation | null;
	onChange: (location: CampLocation) => void;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<L.Map | null>(null);
	const markerRef = useRef<L.Marker | null>(null);
	const initialValueRef = useRef(value);
	const onChangeRef = useRef(onChange);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || mapRef.current) return;

		const initialValue = initialValueRef.current;
		const initialPoint = initialValue ? [initialValue.latitude, initialValue.longitude] as [number, number] : null;
		const map = L.map(container, { scrollWheelZoom: false }).setView(
			initialPoint ?? defaultCenter,
			initialPoint ? 16 : 11,
		);
		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(map);
		mapRef.current = map;

		const setMarker = (latitude: number, longitude: number, notify = true) => {
			if (markerRef.current) {
				markerRef.current.setLatLng([latitude, longitude]);
			} else {
				markerRef.current = L.marker([latitude, longitude], { draggable: true }).addTo(map);
				markerRef.current.on("dragend", () => {
					const point = markerRef.current?.getLatLng();
					if (point) onChangeRef.current({ latitude: point.lat, longitude: point.lng });
				});
			}
			if (notify) onChangeRef.current({ latitude, longitude });
		};

		map.on("click", (event: L.LeafletMouseEvent) => setMarker(event.latlng.lat, event.latlng.lng));
		if (initialPoint) setMarker(initialPoint[0], initialPoint[1], false);

		const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
		resizeObserver.observe(container);
		window.setTimeout(() => map.invalidateSize({ pan: false }), 0);

		return () => {
			resizeObserver.disconnect();
			markerRef.current = null;
			mapRef.current = null;
			map.remove();
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !value) return;
		const point: [number, number] = [value.latitude, value.longitude];
		if (markerRef.current) markerRef.current.setLatLng(point);
		else {
			markerRef.current = L.marker(point, { draggable: true }).addTo(map);
			markerRef.current.on("dragend", () => {
				const draggedPoint = markerRef.current?.getLatLng();
				if (draggedPoint) onChangeRef.current({ latitude: draggedPoint.lat, longitude: draggedPoint.lng });
			});
		}
		map.panTo(point);
	}, [value]);

	return <div ref={containerRef} className="h-72 w-full rounded-2xl" />;
}
