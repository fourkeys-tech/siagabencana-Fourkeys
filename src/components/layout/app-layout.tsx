"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppLayout({ children }: { children: React.ReactNode }) {
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<div className="min-h-screen bg-[var(--background)]">
			<Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
			<Header onMenuClick={() => setMobileOpen(true)} />
			<main className="min-h-screen pt-16 lg:pl-72">
				<div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
					{children}
				</div>
			</main>
		</div>
	);
}
