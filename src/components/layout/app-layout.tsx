"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppLayout({ children }: { children: React.ReactNode }) {
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<div className="min-h-screen bg-[var(--background)] print:min-h-0 print:bg-white">
			<Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
			<Header onMenuClick={() => setMobileOpen(true)} mobileOpen={mobileOpen} />
			<main className="min-h-screen min-w-0 overflow-x-hidden pt-16 lg:pl-72 print:min-h-0 print:overflow-visible print:p-0">
				<div className="mx-auto w-full max-w-[1600px] min-w-0 p-3 sm:p-5 lg:p-8 print:max-w-none print:p-0">
					{children}
				</div>
			</main>
		</div>
	);
}
