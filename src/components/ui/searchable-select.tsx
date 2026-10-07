"use client";

import { ChevronDown, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";

export type SearchableSelectOption = {
	value: string;
	label: string;
	meta?: string;
	disabled?: boolean;
};

export function SearchableSelect({
	label,
	options,
	value,
	onChange,
	placeholder = "Pilih...",
	emptyMessage = "Tidak ada pilihan yang cocok.",
	disabled = false,
}: {
	label: string;
	options: SearchableSelectOption[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	emptyMessage?: string;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const selected = options.find((option) => option.value === value);
	const filteredOptions = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return options;
		return options.filter((option) => `${option.label} ${option.meta ?? ""}`.toLowerCase().includes(normalized));
	}, [options, query]);

	return (
		<div className="space-y-1.5">
			<label className="block text-sm font-medium text-slate-700">{label}</label>
			<button
				type="button"
				disabled={disabled}
				onClick={() => { setQuery(""); setOpen(true); }}
				aria-haspopup="dialog"
				className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm shadow-sm transition hover:border-slate-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
			>
				<span className={selected ? "text-slate-900" : "text-slate-400"}>{selected?.label ?? placeholder}</span>
				<ChevronDown size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
			</button>
			<Modal isOpen={open} onClose={() => setOpen(false)} title={`Pilih ${label}`}>
				<div className="space-y-3">
					<SearchInput value={query} onChange={setQuery} placeholder={`Cari ${label.toLowerCase()}...`} autoFocus />
					<div className="max-h-72 space-y-1 overflow-y-auto" role="listbox" aria-label={label}>
						{filteredOptions.map((option) => (
							<button
								key={option.value}
								type="button"
								disabled={option.disabled}
								role="option"
								aria-selected={option.value === value}
								onClick={() => { onChange(option.value); setOpen(false); }}
								className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-blue-100 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{option.label}</span>{option.meta && <span className="block truncate text-xs text-slate-500">{option.meta}</span>}</span>
								{option.value === value && <Check size={18} className="shrink-0 text-blue-600" aria-hidden="true" />}
							</button>
						))}
						{filteredOptions.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{emptyMessage}</p>}
					</div>
				</div>
			</Modal>
		</div>
	);
}
