import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import {
	exchangeGoogleCodeForUserInfo,
	getGoogleRedirectUri,
	verifyOAuthState,
	OAUTH_STATE_COOKIE,
} from "@/lib/auth/google";
import { safeReturnTo } from "@/lib/navigation";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	const cookieStore = await cookies();
	const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
	cookieStore.delete(OAUTH_STATE_COOKIE);

	const loginUrl = new URL("/login", request.url);

	if (error) {
		loginUrl.searchParams.set("error", "google_cancelled");
		return NextResponse.redirect(loginUrl);
	}

	if (!code || !state || !stateCookie) {
		loginUrl.searchParams.set("error", "invalid_state");
		return NextResponse.redirect(loginUrl);
	}

	const verified = verifyOAuthState(stateCookie);
	if (!verified || verified.state !== state) {
		loginUrl.searchParams.set("error", "invalid_state");
		return NextResponse.redirect(loginUrl);
	}

	const targetReturnTo = safeReturnTo(verified.returnTo, "/dashboard");

	try {
		const redirectUri = getGoogleRedirectUri(request);
		const googleUser = await exchangeGoogleCodeForUserInfo({
			code,
			redirectUri,
		});

		const email = googleUser.email?.trim().toLowerCase();
		if (!email || !googleUser.email_verified) {
			loginUrl.searchParams.set("error", "email_not_verified");
			return NextResponse.redirect(loginUrl);
		}

		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			await writeAuditLog({
				action: "LOGIN_FAILED",
				entity: "Session",
				details: { provider: "google", email, reason: "unregistered_email" },
			});

			loginUrl.searchParams.set("error", "unregistered");
			loginUrl.searchParams.set("email", email);
			return NextResponse.redirect(loginUrl);
		}

		await createSession(user.id);

		// Opportunistic expired sessions cleanup
		prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

		await writeAuditLog({
			userId: user.id,
			action: "LOGIN",
			entity: "Session",
			details: { provider: "google", email: user.email },
		});

		const destinationUrl = new URL(targetReturnTo, request.url);
		return NextResponse.redirect(destinationUrl);
	} catch (err) {
		console.error("GOOGLE_CALLBACK_ERROR", err);
		loginUrl.searchParams.set("error", "token_exchange_failed");
		return NextResponse.redirect(loginUrl);
	}
}

