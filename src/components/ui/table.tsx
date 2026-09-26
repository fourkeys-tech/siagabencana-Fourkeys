export function Table({
	headers,
	children,
}: {
	headers: string[];
	children: React.ReactNode;
}) {
	return (
		<div className="overflow-x-auto rounded-lg border border-gray-200">
			<table className="min-w-full divide-y divide-gray-200">
				<thead className="bg-gray-50">
					<tr>
						{headers.map((h) => (
							<th
								key={h}
								className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="bg-white divide-y divide-gray-200">
					{children}
				</tbody>
			</table>
		</div>
	);
}

export function TableRow({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<tr className={`hover:bg-gray-50 ${className}`}>
			{children}
		</tr>
	);
}

export function TableCell({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}>
			{children}
		</td>
	);
}
