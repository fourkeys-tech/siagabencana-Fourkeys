export function occupancyColor(percentage: number) {
	if (percentage >= 90) return "#dc2626";
	if (percentage >= 70) return "#f59e0b";
	return "#16a34a";
}

export function occupancyBarClass(percentage: number) {
	if (percentage >= 90) return "bg-red-500";
	if (percentage >= 70) return "bg-yellow-500";
	return "bg-green-500";
}
