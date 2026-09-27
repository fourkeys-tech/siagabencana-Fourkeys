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
	const isPublic = pathname === "/" || publicRoutes.some((route) => pathname.startsWith(route));
	const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

	return (
		<UserProvider>
			{isPublic || isAuthRoute ? children : <AuthGuard><AppLayout>{children}</AppLayout></AuthGuard>}
		</UserProvider>
	);
}