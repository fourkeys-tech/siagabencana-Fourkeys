import crypto from "crypto";

export const OAUTH_STATE_COOKIE = "siaga_oauth_state";
export const OAUTH_STATE_MAX_AGE = 60 * 10; // 10 menit

export type GoogleUserInfo = {
	sub: string;
	name: string;
	email: string;
	email_verified?: boolean;
	picture?: string;
};

export function isGoogleAuthConfigured(): boolean {
	return Boolean(
		process.env.GOOGLE_CLIENT_ID?.trim() &&
		process.env.GOOGLE_CLIENT_SECRET?.trim(),
	);
}

export function getAppBaseUrl(request?: Request): string {
	if (process.env.APP_URL?.trim()) {
		return process.env.APP_URL.trim().replace(/\/+$/, "");
	}
	if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
		return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, "");
	}
	if (request) {
		const proto = request.headers.get("x-forwarded-proto") || "http";
		const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
		if (host) {
			return `${proto}://${host}`;
		}
		try {
			return new URL(request.url).origin;
		} catch {
			// fallback
		}
	}
	return "http://localhost:3000";
}

export function getGoogleRedirectUri(request?: Request): string {
	if (process.env.GOOGLE_REDIRECT_URI?.trim()) {
		return process.env.GOOGLE_REDIRECT_URI.trim();
	}
	return `${getAppBaseUrl(request)}/api/auth/google/callback`;
}

function getOAuthSigningSecret(): string {
	return (
		process.env.GOOGLE_CLIENT_SECRET?.trim() ||
		process.env.DATABASE_URL?.trim() ||
		"siaga-bencana-oauth-signing-secret"
	);
}

export function signOAuthState(payload: { state: string; returnTo: string }): string {
	const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const sig = crypto
		.createHmac("sha256", getOAuthSigningSecret())
		.update(data)
		.digest("base64url");
	return `${data}.${sig}`;
}

export function verifyOAuthState(token: string): { state: string; returnTo: string } | null {
	if (!token || typeof token !== "string") return null;
	const parts = token.split(".");
	if (parts.length !== 2) return null;
	const [data, sig] = parts;
	if (!data || !sig) return null;

	const expectedSig = crypto
		.createHmac("sha256", getOAuthSigningSecret())
		.update(data)
		.digest("base64url");

	// Timing-safe comparison to prevent timing attacks
	if (sig.length !== expectedSig.length) return null;
	const sigBuf = Buffer.from(sig);
	const expectedBuf = Buffer.from(expectedSig);
	if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

	try {
		const json = Buffer.from(data, "base64url").toString("utf8");
		const parsed = JSON.parse(json);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			typeof parsed.state !== "string" ||
			typeof parsed.returnTo !== "string"
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function generateGoogleAuthUrl(params: {
	redirectUri: string;
	state: string;
}): string {
	const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
	if (!clientId) {
		throw new Error("GOOGLE_CLIENT_ID is not configured");
	}

	const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", "openid email profile");
	url.searchParams.set("state", params.state);
	url.searchParams.set("prompt", "select_account");
	url.searchParams.set("access_type", "online");

	return url.toString();
}

export async function exchangeGoogleCodeForUserInfo(params: {
	code: string;
	redirectUri: string;
}): Promise<GoogleUserInfo> {
	const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

	if (!clientId || !clientSecret) {
		throw new Error("Google OAuth credentials are not configured");
	}

	const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			code: params.code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: params.redirectUri,
			grant_type: "authorization_code",
		}),
	});

	if (!tokenResponse.ok) {
		const errorText = await tokenResponse.text();
		console.error("GOOGLE_TOKEN_EXCHANGE_ERROR", tokenResponse.status, errorText);
		throw new Error(`Failed to exchange authorization code: ${tokenResponse.status}`);
	}

	const tokenData = await tokenResponse.json();
	const accessToken = tokenData.access_token;
	if (!accessToken) {
		throw new Error("No access_token returned by Google");
	}

	const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!userInfoResponse.ok) {
		const errorText = await userInfoResponse.text();
		console.error("GOOGLE_USERINFO_ERROR", userInfoResponse.status, errorText);
		throw new Error(`Failed to fetch user info from Google: ${userInfoResponse.status}`);
	}

	const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;
	return userInfo;
}

