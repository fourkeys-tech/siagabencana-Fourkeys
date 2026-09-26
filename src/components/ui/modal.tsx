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
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div
				className="absolute inset-0 bg-black/50"
				onClick={onClose}
			/>
			<div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold text-gray-900">
						{title}
					</h3>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600"
					>
						✕
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}
