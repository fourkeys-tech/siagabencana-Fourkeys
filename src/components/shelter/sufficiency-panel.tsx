import {
	FACILITY_CATEGORY_INFO,
	formatFacilityQuantity,
	overallSufficiencyLabels,
	type CategoryAssessment,
	type FacilityAssessment,
	type OverallSufficiency,
	type SufficiencyStatus,
} from "@/lib/shelter-standards";

export type CampSufficiency = {
	campId: string;
	campName: string;
	occupants: number;
	assessment: FacilityAssessment;
};

const overallStyles: Record<OverallSufficiency, string> = {
	SUFFICIENT: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
	SHORT: "bg-rose-50 text-rose-700 ring-rose-600/20",
	INCOMPLETE: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const statusStyles: Record<SufficiencyStatus, { dot: string; text: string; label: string }> = {
	SUFFICIENT: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Cukup" },
	SHORT: { dot: "bg-rose-500", text: "text-rose-700", label: "Kurang" },
	NO_DATA: { dot: "bg-slate-300", text: "text-slate-500", label: "Belum didata" },
};

function valueText(item: CategoryAssessment) {
	if (item.status === "NO_DATA") return "Belum didata";
	if (FACILITY_CATEGORY_INFO[item.category].standard.kind === "PRESENCE") {
		return item.available > 0 ? `${item.available.toLocaleString("id-ID")} berfungsi` : "Tidak ada yang berfungsi";
	}
	return `${formatFacilityQuantity(item.available, item.unit)} dari ${formatFacilityQuantity(item.required, item.unit)}`;
}

function CampCard({ camp }: { camp: CampSufficiency }) {
	const { overall, categories } = camp.assessment;
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`Kecukupan ${camp.campName}`}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="truncate text-sm font-bold text-slate-900">{camp.campName}</h3>
					<p className="text-xs text-slate-500">{camp.occupants.toLocaleString("id-ID")} jiwa saat ini</p>
				</div>
				<span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${overallStyles[overall]}`}>
					{overallSufficiencyLabels[overall]}
				</span>
			</div>
			<ul className="mt-3 divide-y divide-slate-100">
				{categories.map((item) => {
					const style = statusStyles[item.status];
					return (
						<li key={item.category} className="flex items-center justify-between gap-3 py-2">
							<div className="flex min-w-0 items-center gap-2">
								<span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
									<p className="text-[11px] text-slate-500">Standar: {item.standardLabel}</p>
								</div>
							</div>
							<div className="shrink-0 text-right">
								<p className={`text-xs font-semibold ${style.text}`}>
									<span className="sr-only">{style.label}: </span>
									{valueText(item)}
								</p>
								{item.status === "SHORT" && item.shortfall > 0 && FACILITY_CATEGORY_INFO[item.category].standard.kind !== "PRESENCE" && (
									<p className="text-[11px] text-rose-600">kurang {formatFacilityQuantity(item.shortfall, item.unit)}</p>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

export function SufficiencyPanel({ camps }: { camps: CampSufficiency[] }) {
	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-lg font-bold text-slate-900">Kecukupan posko</h2>
				<p className="text-sm text-slate-500">
					Hanya fasilitas berstatus Baik yang dihitung. Patokan mengikuti standar minimum Sphere untuk penampungan pengungsi.
				</p>
			</div>
			{camps.length === 0 ? (
				<p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Belum ada posko aktif.</p>
			) : (
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{camps.map((camp) => <CampCard key={camp.campId} camp={camp} />)}
				</div>
			)}
		</div>
	);
}
