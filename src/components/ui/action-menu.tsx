"use client";

import { MoreVertical } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

export type ActionMenuItem = {
	label: string;
	href?: string;
	onSelect?: () => void;
	disabled?: boolean;
	danger?: boolean;
};

export function ActionMenu({
	label = "aksi",
	items,
	disabled = false,
}: {
	label?: string;
	items: ActionMenuItem[];
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState({ top: 0, right: 0 });
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const menuId = useId();

	const updatePosition = useCallback(() => {
		const button = buttonRef.current;
		if (!button) return;
		const rect = button.getBoundingClientRect();
		setPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
	}, []);

	useEffect(() => {
		if (!open) return;
		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				setOpen(false);
				buttonRef.current?.focus();
				return;
			}
			if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
			event.preventDefault();
			const available = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])") ?? []);
			if (!available.length) return;
			const current = available.indexOf(document.activeElement as HTMLElement);
			const next = event.key === "ArrowDown"
				? available[(current + 1) % available.length]
				: available[(current - 1 + available.length) % available.length];
			next.focus();
		};
		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [open, updatePosition]);

	useEffect(() => {
		if (!open) return;
		const firstItem = menuRef.current?.querySelector<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])");
		firstItem?.focus();
	}, [open, updatePosition]);

	const close = () => {
		setOpen(false);
		buttonRef.current?.focus();
	};

	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				aria-label={`Aksi untuk ${label}`}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={menuId}
				disabled={disabled}
				onClick={() => {
					updatePosition();
					setOpen((current) => !current);
				}}
				className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<MoreVertical size={20} aria-hidden="true" />
			</button>
			{open && typeof document !== "undefined" && createPortal(
				<div
					ref={menuRef}
					id={menuId}
					role="menu"
					aria-label={`Aksi untuk ${label}`}
					className="fixed z-[70] min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
					style={{ top: position.top, right: position.right }}
				>
					{items.map((item) => {
						const className = `flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${item.danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-100"} ${item.disabled ? "cursor-not-allowed opacity-50" : ""}`;
						const handleSelect = () => {
							if (item.disabled) return;
							item.onSelect?.();
							close();
						};
						if (item.href) {
							return <Link key={item.label} href={item.href} role="menuitem" aria-disabled={item.disabled || undefined} tabIndex={item.disabled ? -1 : 0} className={className} onClick={(event) => {
									if (item.disabled) {
										event.preventDefault();
										return;
									}
									handleSelect();
								}}>{item.label}</Link>;
						}
						return <button key={item.label} type="button" role="menuitem" aria-disabled={item.disabled || undefined} disabled={item.disabled} className={className} onClick={handleSelect}>{item.label}</button>;
					})}
				</div>,
				document.body,
			)}
		</>
	);
}
