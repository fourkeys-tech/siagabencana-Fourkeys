"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export function Pagination({
	page,
	totalPages,
	total,
	onPageChange,
	disabled = false,
}: {
	page: number;
	totalPages: number;
	total?: number;
	onPageChange: (newPage: number) => void;
	disabled?: boolean;
}) {
	if (totalPages <= 1 && (!total || total === 0)) {
		return null;
	}

	return (
		<nav
			aria-label="Paginasi"
			className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row"
		>
			<p className="text-xs text-slate-500">
				Halaman <span className="font-semibold text-slate-900">{page}</span> dari{" "}
				<span className="font-semibold text-slate-900">{Math.max(totalPages, 1)}</span>
				{typeof total === "number" ? (
					<> (Total <span className="font-semibold text-slate-900">{total}</span> data)</>
				) : null}
			</p>
			<div className="flex items-center gap-2">
				<Button
					variant="secondary"
					className="min-h-9 px-3 py-1.5 text-xs"
					onClick={() => onPageChange(page - 1)}
					disabled={disabled || page <= 1}
					aria-label="Halaman sebelumnya"
				>
					<ChevronLeft size={14} />
					Sebelumnya
				</Button>
				<Button
					variant="secondary"
					className="min-h-9 px-3 py-1.5 text-xs"
					onClick={() => onPageChange(page + 1)}
					disabled={disabled || page >= totalPages}
					aria-label="Halaman selanjutnya"
				>
					Selanjutnya
					<ChevronRight size={14} />
				</Button>
			</div>
		</nav>
	);
}
