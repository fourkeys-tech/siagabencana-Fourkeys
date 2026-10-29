import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { safeReturnTo } from "@/lib/navigation";

const SESSION_COOKIE = "siaga_session";

// Cek optimistik: hanya memastikan cookie sesi ada agar halaman terproteksi tidak
// ter-render untuk tamu. Validasi sesi & otorisasi tetap di API (src/lib/auth/guard.ts).
export function proxy(request: NextRequest) {
	if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

	const loginUrl = new URL("/login", request.url);
	loginUrl.searchParams.set("returnTo", safeReturnTo(`${request.nextUrl.pathname}${request.nextUrl.search}`));
	return NextResponse.redirect(loginUrl);
}

export const config = {
	matcher: [
		"/dashboard/:path*",
		"/monitoring/:path*",
		"/peta/:path*",
		"/kelola-posko/:path*",
		"/logistik/:path*",
		"/shelter/:path*",
		"/pengungsi/:path*",
		"/distribusi/:path*",
		"/laporan/:path*",
		"/aktivitas/:path*",
		"/users/:path*",
		"/pengaturan/:path*",
	],
};
