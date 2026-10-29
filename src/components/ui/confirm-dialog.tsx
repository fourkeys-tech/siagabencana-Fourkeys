"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

export function ConfirmDialog({
	isOpen,
	title,
	message,
	confirmLabel = "Konfirmasi",
	cancelLabel = "Batal",
	variant = "primary",
	busy = false,
	onConfirm,
	onClose,
}: {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "primary" | "danger";
	busy?: boolean;
	onConfirm: () => void | Promise<void>;
	onClose: () => void;
}) {
	return (
		<Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title={title}>
			<div className="space-y-6">
				<p className="text-sm leading-relaxed text-slate-600">{message}</p>
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button
						variant="secondary"
						onClick={onClose}
						disabled={busy}
					>
						{cancelLabel}
					</Button>
					<Button
						variant={variant}
						onClick={onConfirm}
						disabled={busy}
					>
						{busy ? "Memproses..." : confirmLabel}
					</Button>
				</div>
			</div>
		</Modal>
	);
}

export function PromptDialog({
	isOpen,
	title,
	message,
	inputLabel,
	placeholder = "",
	defaultValue = "",
	confirmLabel = "Kirim",
	cancelLabel = "Batal",
	variant = "primary",
	busy = false,
	required = false,
	onConfirm,
	onClose,
}: {
	isOpen: boolean;
	title: string;
	message: string;
	inputLabel?: string;
	placeholder?: string;
	defaultValue?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "primary" | "danger";
	busy?: boolean;
	required?: boolean;
	onConfirm: (value: string) => void | Promise<void>;
	onClose: () => void;
}) {
	const [value, setValue] = useState(defaultValue);
	const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
	if (isOpen !== prevIsOpen) {
		setPrevIsOpen(isOpen);
		if (isOpen) {
			setValue(defaultValue);
		}
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (required && !value.trim()) return;
		void onConfirm(value);
	};

	return (
		<Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title={title}>
			<form onSubmit={handleSubmit} className="space-y-5">
				<p className="text-sm leading-relaxed text-slate-600">{message}</p>
				<div>
					{inputLabel ? (
						<label className="mb-1.5 block text-xs font-semibold text-slate-700">
							{inputLabel}
						</label>
					) : null}
					<textarea
						className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
						rows={3}
						placeholder={placeholder}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						disabled={busy}
						required={required}
						autoFocus
					/>
				</div>
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button
						variant="secondary"
						onClick={onClose}
						disabled={busy}
					>
						{cancelLabel}
					</Button>
					<Button
						type="submit"
						variant={variant}
						disabled={busy || (required && !value.trim())}
					>
						{busy ? "Memproses..." : confirmLabel}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
