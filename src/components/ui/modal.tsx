export function Modal({
	isOpen,
	onClose,
	title,
	children,
}: {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}) {
	if (!isOpen) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
			<div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
			<div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
				<div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
					<h3 className="text-lg font-bold tracking-tight text-slate-950">
						{title}
					</h3>
					<button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
				</div>
				{children}
			</div>
		</div>
	);
}
