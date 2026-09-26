"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
	const pathname = usePathname();
	const navItems = [
		{ href: "/dashboard", label: "Dashboard", icon: "📊" },
		{ href: "/kelola-posko", label: "Kelola Posko", icon: "🏕️" },
		{ href: "/logistik", label: "Logistik", icon: "📦" },
		{ href: "/shelter", label: "Shelter", icon: "🏠" },
		{ href: "/pengungsi", label: "Pengungsi", icon: "👥" },
		{ href: "/users", label: "Pengguna", icon: "👤" },
	];

	return (
		<aside className="w-64 bg-gray-900 text-white min-h-screen p-4 fixed left-0 top-0">
			<div className="mb-8">
				<h1 className="text-xl font-bold">Siaga Bencana</h1>
				<p className="text-gray-400 text-sm">Manajemen Bencana</p>
			</div>
			<nav>
				<ul className="space-y-1">
					{navItems.map((item) => {
						const isActive = pathname === item.href;
						return (
							<li key={item.href}>
								<Link
									href={item.href}
									className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}
								>
									<span>{item.icon}</span>
									<span>{item.label}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
		</aside>
	);
}
