export function Button({
	children,
	variant = "primary",
	className = "",
	onClick,
	type = "button",
	disabled,
	fullWidth = false,
}: {
	children: React.ReactNode;
	variant?: "primary" | "secondary" | "danger" | "ghost";
	className?: string;
	onClick?: () => void;
	type?: "button" | "submit";
	disabled?: boolean;
	fullWidth?: boolean;
}) {
	const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
	const variants = {
		primary: "bg-[var(--primary)] text-white shadow-sm shadow-blue-200 hover:bg-[var(--primary-dark)]",
		secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
		danger: "bg-rose-600 text-white shadow-sm shadow-rose-200 hover:bg-rose-700",
		ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
	};
	return <button className={`${base} ${fullWidth ? "w-full" : ""} ${variants[variant]} ${className}`} onClick={onClick} type={type} disabled={disabled}>{children}</button>;
}