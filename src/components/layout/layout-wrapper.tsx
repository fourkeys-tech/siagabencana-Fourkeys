"use client";

import { usePathname } from "next/navigation";
import { AppLayout } from "./app-layout";
import { AuthGuard } from "@/components/auth/auth-guard";
import { UserProvider } from "@/components/auth/user-provider";

const authRoutes = ["/login"];
const publicRoutes = ["/public"];

export function LayoutWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	// Landing page dan halaman publik
	if (
		pathname === "/" ||
		publicRoutes.some((route) => pathname.startsWith(route))
	) {
		return <>{children}</>;
	}

	// Halaman login
	// LoginPage sendiri sudah menggunakan AuthLayout
	if (authRoutes.some((route) => pathname.startsWith(route))) {
		return <>{children}</>;
	}

	// Semua halaman lainnya membutuhkan autentikasi
	return (
		<UserProvider>
			<AuthGuard>
				<AppLayout>{children}</AppLayout>
			</AuthGuard>
		</UserProvider>
	);
}