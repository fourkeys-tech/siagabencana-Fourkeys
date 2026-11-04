export function Table({
	headers,
	children,
	label = "Tabel data",
	minWidth = "min-w-[42rem]",
	className = "",
}: {
	headers: string[];
	children: React.ReactNode;
	label?: string;
	minWidth?: string;
	className?: string;
}) {
	return (
		<div className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-lg print:border-slate-300 print:shadow-none ${className}`}>
			<div className="overflow-x-auto print:overflow-visible" role="region" aria-label={label} tabIndex={0}>
				<table className={`w-full ${minWidth} divide-y divide-slate-200 print:min-w-0 print:divide-slate-300`}>
					<thead className="bg-slate-50 print:bg-slate-100">
						<tr>
							{headers.map((header) => (
								<th
									key={header}
									scope="col"
									className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-5 sm:py-3.5 print:px-2 print:py-1.5 print:text-[9px] print:text-slate-700"
								>
									{header}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100 print:divide-slate-200">{children}</tbody>
				</table>
			</div>
		</div>
	);
}

export function TableRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
	return <tr className={`transition hover:bg-slate-50/80 print:hover:bg-transparent ${className}`}>{children}</tr>;
}

export function TableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
	return <td className={`whitespace-nowrap px-5 py-4 text-sm text-slate-700 print:px-2 print:py-1.5 print:text-[11px] ${className}`}>{children}</td>;
}
