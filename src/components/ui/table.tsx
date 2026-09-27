export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
	return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>;
}

export function TableRow({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <tr className={`transition hover:bg-slate-50/80 ${className}`}>{children}</tr>; }
export function TableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`whitespace-nowrap px-5 py-4 text-sm text-slate-700 ${className}`}>{children}</td>; }
