export function PageHeader({
	eyebrow,
	title,
	description,
	action,
}: {
	eyebrow?: React.ReactNode;
	title: React.ReactNode;
	description?: React.ReactNode;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				{eyebrow && <div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">{eyebrow}</div>}
				<h1 className="break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
				{description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
			</div>
			{action && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div>}
		</div>
	);
}