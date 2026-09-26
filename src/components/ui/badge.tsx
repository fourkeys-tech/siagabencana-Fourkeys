const badgeStyles: Record<string, string> = {
	SUFFICIENT: "bg-green-100 text-green-800",
	LOW: "bg-yellow-100 text-yellow-800",
	CRITICAL: "bg-red-100 text-red-800",
	SPOILED_OR_DAMAGED: "bg-red-200 text-red-900",
	GOOD: "bg-green-100 text-green-800",
	DAMAGED: "bg-red-100 text-red-800",
	REPAIRING: "bg-yellow-100 text-yellow-800",
	ACTIVE: "bg-green-100 text-green-800",
	CLOSED: "bg-gray-100 text-gray-800",
	SUPER_ADMIN: "bg-purple-100 text-purple-800",
	MANAGER: "bg-blue-100 text-blue-800",
	FIELD_OFFICER: "bg-gray-100 text-gray-800",
	LOGISTICS: "bg-blue-100 text-blue-800",
	SHELTER: "bg-yellow-100 text-yellow-800",
	DATA_REGISTRATION: "bg-green-100 text-green-800",
};

export function Badge({ label }: { label: string }) {
	return (
		<span
			className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStyles[label] ?? "bg-gray-100 text-gray-800"}`}
		>
			{label}
		</span>
	);
}
