export function Table({ headers, children, label = "Tabel data" }: { headers: string[]; children: React.ReactNode; label?: string }) {
	return <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}><table className="min-w-[42rem] divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-5 sm:py-3.5">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div></div>;
}

export function TableRow({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <tr className={`transition hover:bg-slate-50/80 ${className}`}>{children}</tr>; }
export function TableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`whitespace-nowrap px-5 py-4 text-sm text-slate-700 ${className}`}>{children}</td>; }
