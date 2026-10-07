"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
let openModalCount = 0;
let bodyOverflowBeforeModal: string | null = null;

export function Modal({
	isOpen,
	onClose,
	title,
	children,
}: {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
}) {
	const dialogRef = useRef<HTMLDivElement | null>(null);
	const titleId = useId();
	const previouslyFocused = useRef<HTMLElement | null>(null);
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	useEffect(() => {
		if (!isOpen) return;
		previouslyFocused.current = document.activeElement as HTMLElement;
		if (openModalCount === 0) bodyOverflowBeforeModal = document.body.style.overflow;
		openModalCount += 1;
		const dialog = dialogRef.current;
		if (dialog) {
			const preferred = dialog.querySelector<HTMLElement>("[data-modal-autofocus='true']");
			const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
			if (preferred) preferred.focus();
			else focusables[0]?.focus();
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				const activeDialog = document.activeElement?.closest<HTMLElement>("[role='dialog']");
				if (activeDialog && activeDialog !== dialogRef.current) return;
				event.preventDefault();
				onCloseRef.current();
				return;
			}
			if (event.key !== "Tab" || !dialogRef.current) return;
			const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement as HTMLElement | null;
			if (event.shiftKey && active === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", onKeyDown);
		document.body.style.overflow = "hidden";

		return () => {
			document.removeEventListener("keydown", onKeyDown);
			openModalCount = Math.max(0, openModalCount - 1);
			if (openModalCount === 0) {
				document.body.style.overflow = bodyOverflowBeforeModal ?? "";
				bodyOverflowBeforeModal = null;
			}
			if (previouslyFocused.current && document.contains(previouslyFocused.current)) {
				previouslyFocused.current.focus();
			}
			previouslyFocused.current = null;
		};
	}, [isOpen]);

	if (!isOpen) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4" role="presentation">
			<div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className="relative max-h-[min(92dvh,48rem)] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
			>
				<div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
					<h3 id={titleId} className="text-lg font-bold tracking-tight text-slate-950">{title}</h3>
					<button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
				</div>
				{children}
			</div>
		</div>
	);
}
