"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "./user-provider";
import { canAccessPath, findNavItem } from "@/lib/navigation";
import { Alert } from "@/components/ui/alert";

export function AuthGuard({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { user, loading, refresh } = useSession();

	useEffect(() => {
		refresh();
	}, [pathname, refresh]);

	useEffect(() => {
		if (!loading && !user) {
			router.replace("/login");
		}
	}, [loading, user, router]);

	if (loading || !user) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<span className="text-gray-500">Memuat...</span>
			</div>
		);
	}

	const match = findNavItem(pathname);

	if (match?.item.disabled) {
		return (
			<div className="min-h-screen flex items-center justify-center p-6">
				<div className="max-w-md space-y-4 text-center">
					<Alert type="warning">
						Halaman <strong>{match.item.label}</strong> masih dalam
						pengembangan dan belum tersedia.
					</Alert>

					<Link
						href="/dashboard"
						className="text-sm font-medium text-blue-600 hover:underline"
					>
						Kembali ke Dashboard
					</Link>
				</div>
			</div>
		);
	}

	if (match && !canAccessPath(pathname, user)) {
		return (
			<div className="min-h-screen flex items-center justify-center p-6">
				<div className="max-w-md space-y-4 text-center">
					<Alert type="error">
						Akses ditolak. Akun Anda tidak memiliki hak akses ke
						halaman ini.
					</Alert>

					<Link
						href="/dashboard"
						className="text-sm font-medium text-blue-600 hover:underline"
					>
						Kembali ke Dashboard
					</Link>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
