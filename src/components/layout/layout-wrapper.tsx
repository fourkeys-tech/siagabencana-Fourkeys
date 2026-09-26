"use client";

import { usePathname } from "next/navigation";
import { AppLayout } from "./app-layout";
import { AuthLayout } from "./auth-layout";
import { AuthGuard } from "@/components/auth/auth-guard";

const authRoutes = ["/login"];
const publicRoutes = ["/public"];

export function LayoutWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	if (pathname === "/" || publicRoutes.some((route) => pathname.startsWith(route))) {
		return <>{children}</>;
	}

	if (authRoutes.some((route) => pathname.startsWith(route))) {
		return <AuthLayout>{children}</AuthLayout>;
	}

	return (
		<AuthGuard>
			<AppLayout>{children}</AppLayout>
		</AuthGuard>
	);
}
