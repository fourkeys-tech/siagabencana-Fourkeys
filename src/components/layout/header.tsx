"use client";

import { useRouter } from "next/navigation";

export function Header() {
	const router = useRouter();

	const handleLogout = async () => {
		await fetch("/api/auth/logout", {
			method: "POST",
		});
		router.push("/login");
	};

	return (
		<header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between ml-64 fixed top-0 right-0 left-0">
			<div>
				<h2 className="text-lg font-semibold text-gray-800">
					Siaga Bencana
				</h2>
			</div>
			<div className="flex items-center gap-4">
				<span className="text-sm text-gray-600">
					Siaga Bencana App
				</span>
				<button
					onClick={handleLogout}
					className="text-sm bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
				>
					Logout
				</button>
			</div>
		</header>
	);
}
