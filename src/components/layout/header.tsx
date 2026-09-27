"use client";

import Link from "next/link";
import { Menu, ExternalLink, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { getBreadcrumb } from "@/lib/navigation";
import { useSession } from "@/components/auth/user-provider";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
	const pathname = usePathname();
	const match = getBreadcrumb(pathname);
	const { user } = useSession();
	return <header className="fixed left-0 right-0 z-30 h-16 border-b border-[var(--line)] bg-white/95 backdrop-blur lg:left-72" aria-label="Header workspace"><div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={onMenuClick} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-blue-500/30 lg:hidden" aria-label="Buka menu" aria-controls="app-navigation"><Menu size={20} /></button><div className="min-w-0"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="hidden sm:inline">Workspace</span>{match && <><ChevronRight size={13} aria-hidden="true" /><span>{match.section.label}</span></>}</div><h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{match?.item.label ?? "Siaga Bencana"}</h1></div></div><div className="flex items-center gap-2"><Link href="/public" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-4 focus-visible:ring-blue-500/30"><ExternalLink size={14} aria-hidden="true" /> <span>Halaman publik</span></Link><div className="hidden h-8 w-px bg-slate-200 sm:block" /><div className="hidden text-right md:block"><p className="text-xs font-semibold text-slate-800">{user?.name ?? "Memuat..."}</p><p className="text-[10px] text-slate-500">{user?.role ?? ""}</p></div><div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{user?.name?.slice(0, 1).toUpperCase() ?? "S"}</div></div></div></header>;
}
