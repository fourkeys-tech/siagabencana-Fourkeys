"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { X, LogOut, Circle } from "lucide-react";
import { useSession } from "@/components/auth/user-provider";
import { NAV_SECTIONS, isItemVisible } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";

export function Sidebar({
	mobileOpen,
	onClose,
}: {
	mobileOpen: boolean;
	onClose: () => void;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { user, refresh } = useSession();
	const [loggingOut, setLoggingOut] = useState(false);
	const sections = NAV_SECTIONS.map((section) => ({
		...section,
		items: section.items.filter((item) => isItemVisible(item, user)),
	})).filter((section) => section.items.length > 0);

	const handleLogout = async () => {
		if (loggingOut) return;
		setLoggingOut(true);
		try {
			const res = await fetch("/api/auth/logout", { method: "POST" });
			if (!res.ok) throw new Error("Logout gagal");
			await refresh();
			router.push("/login");
			router.refresh();
		} catch {
			setLoggingOut(false);
		}
	};

	return (
		<>
			{mobileOpen && <button type="button" aria-label="Tutup menu navigasi" onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
			<aside id="app-navigation" aria-label="Navigasi utama" aria-hidden={!mobileOpen} className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,20rem)] flex-col bg-[var(--sidebar)] text-white shadow-2xl transition-transform duration-200 lg:w-72 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
				<div className="flex h-20 w-full items-center border-b border-white/10 px-5 overflow-hidden">
					<Link
						href="/dashboard"
						onClick={onClose}
						aria-label="Buka dashboard Siaga Bencana"
						className="flex min-w-0 w-full items-center overflow-hidden rounded-md focus-visible:ring-4 focus-visible:ring-blue-400/40"
					>
						<Image
							src="/sidebar.svg"
							alt="Fourkeys Siaga Bencana"
							width={220}
							height={70}
							priority
							className="block h-auto w-[220px] max-w-full object-contain object-left"
						/>
					</Link>

					<button
						type="button"
						onClick={onClose}
						aria-label="Tutup menu navigasi"
						className="ml-2 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:ring-4 focus-visible:ring-blue-400/40 lg:hidden"
					>
						<X size={19} aria-hidden="true" />
					</button>
				</div>

				<nav aria-label="Menu aplikasi" className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
					{sections.map((section) => <div key={section.id}><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{section.label}</p><ul className="space-y-1">{section.items.map((item) => {
						const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
						if (item.disabled) return <li key={item.href}><span className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600">{item.label}<span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">Segera</span></span></li>;
						return <li key={item.href}><Link href={item.href} onClick={onClose} aria-current={active ? "page" : undefined} className={`flex items-center rounded-xl px-3 py-2.5 text-[13px] font-semibold transition focus-visible:ring-4 focus-visible:ring-blue-400/40 ${active ? "bg-blue-500 text-white shadow-lg shadow-blue-950/30" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}><span className={`mr-3 h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-slate-600"}`} />{item.label}</Link></li>;
					})}</ul></div>)}
				</nav>

				<div className="border-t border-white/10 p-4">
					{user ? <div className="mb-4 rounded-xl bg-white/5 p-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">{user.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{user.name}</p><p className="truncate text-[11px] text-slate-400">{user.email}</p></div></div><div className="mt-3 flex flex-wrap gap-1.5"><Badge label={user.role} />{user.division && <Badge label={user.division} />}</div></div> : <div className="mb-4 h-16 animate-pulse rounded-xl bg-white/5" />}
					<button type="button" onClick={handleLogout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-xl border border-rose-400/20 px-3 py-2.5 text-left text-[13px] font-semibold text-rose-300 transition hover:bg-rose-500 hover:text-white disabled:opacity-50"><LogOut size={16} />{loggingOut ? "Keluar..." : "Keluar"}</button>
					<div className="mt-4 flex items-center gap-2 px-1 text-[11px] text-slate-500"><Circle size={8} fill="currentColor" className="text-emerald-400" />Sistem online<span className="ml-auto text-slate-600">v0.1</span></div>
				</div>
			</aside>
		</>
	);
}
