"use client";

import { Search } from "lucide-react";

export function SearchInput({
	value,
	onChange,
	placeholder = "Cari...",
	className = "",
	autoFocus = false,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
}) {
	return (
		<div className={`relative ${className}`}>
			<Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
			<input
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				data-modal-autofocus={autoFocus ? "true" : undefined}
				autoFocus={autoFocus}
				className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
			/>
		</div>
	);
}

export function filterByQuery<T>(
	items: T[],
	query: string,
	fields: (keyof T)[],
): T[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return items;
	return items.filter((item) =>
		fields.some((field) => {
			const value = item[field];
			if (value === null || value === undefined) return false;
			return String(value).toLowerCase().includes(normalized);
		}),
	);
}
