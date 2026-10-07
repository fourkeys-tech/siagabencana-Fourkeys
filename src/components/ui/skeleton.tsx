export function Skeleton({ className = "" }: { className?: string }) {
	return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
	return (
		<div className={`space-y-2 ${className}`} aria-hidden="true">
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton key={i} className="h-3" />
			))}
		</div>
	);
}

export function SkeletonCard({ className = "" }: { className?: string }) {
	return (
		<div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} aria-hidden="true">
			<Skeleton className="h-3 w-24" />
			<Skeleton className="mt-3 h-7 w-16" />
			<Skeleton className="mt-4 h-2 w-full" />
		</div>
	);
}