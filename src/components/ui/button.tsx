export function Button({
	children,
	variant = "primary",
	className = "",
	onClick,
	type = "button",
	disabled,
}: {
	children: React.ReactNode;
	variant?: "primary" | "secondary" | "danger" | "ghost";
	className?: string;
	onClick?: () => void;
	type?: "button" | "submit";
	disabled?: boolean;
}) {
	const base =
		"px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed";
	const variants = {
		primary:
			"bg-blue-600 text-white hover:bg-blue-700",
		secondary:
			"bg-gray-200 text-gray-800 hover:bg-gray-300",
		danger:
			"bg-red-600 text-white hover:bg-red-700",
		ghost:
			"bg-transparent text-gray-700 hover:bg-gray-100 border border-gray-300",
	};
	return (
		<button
			className={`${base} ${variants[variant]} ${className}`}
			onClick={onClick}
			type={type}
			disabled={disabled}
		>
			{children}
		</button>
	);
}
