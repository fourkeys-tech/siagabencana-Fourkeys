import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import {
	isGoogleAuthConfigured,
	generateGoogleAuthUrl,
	getGoogleRedirectUri,
	signOAuthState,
	OAUTH_STATE_COOKIE,
	OAUTH_STATE_MAX_AGE,
} from "@/lib/auth/google";
import { safeReturnTo } from "@/lib/navigation";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

	if (!isGoogleAuthConfigured()) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("error", "not_configured");
		return NextResponse.redirect(loginUrl);
	}

	const state = crypto.randomBytes(24).toString("hex");
	const redirectUri = getGoogleRedirectUri(request);
	const signedState = signOAuthState({ state, returnTo });

	const googleAuthUrl = generateGoogleAuthUrl({
		redirectUri,
		state,
	});

	const cookieStore = await cookies();
	cookieStore.set(OAUTH_STATE_COOKIE, signedState, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: OAUTH_STATE_MAX_AGE,
		path: "/",
	});

	return NextResponse.redirect(googleAuthUrl);
}

