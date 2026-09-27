export function Alert({
	type = "info",
	children,
}: {
	type?: "info" | "success" | "error" | "warning";
	children: React.ReactNode;
}) {
	const styles = {
		info: "bg-blue-50 border-blue-200 text-blue-800",
		success: "bg-green-50 border-green-200 text-green-800",
		error: "bg-red-50 border-red-200 text-red-800",
		warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
	};
	return (
		<div role={type === "error" || type === "warning" ? "alert" : "status"} aria-live={type === "error" || type === "warning" ? "assertive" : "polite"} className={`p-4 rounded-lg border ${styles[type]}`}>
			{children}
		</div>
	);
}
