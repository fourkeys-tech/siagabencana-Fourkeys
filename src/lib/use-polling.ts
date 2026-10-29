"use client";

import { useEffect, useRef } from "react";

export function usePolling(
	callback: () => void | Promise<void>,
	intervalMs: number = 30_000,
	options: { enabled?: boolean; immediate?: boolean } = {},
) {
	const { enabled = true, immediate = true } = options;
	const callbackRef = useRef(callback);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;
		const execute = () => {
			if (!cancelled && !document.hidden) {
				void callbackRef.current();
			}
		};

		if (immediate) {
			execute();
		}

		const interval = window.setInterval(execute, intervalMs);
		const onVisibilityChange = () => {
			if (!document.hidden) {
				execute();
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [intervalMs, enabled, immediate]);
}
