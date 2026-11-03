import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
	isGoogleAuthConfigured,
	getAppBaseUrl,
	getGoogleRedirectUri,
	generateGoogleAuthUrl,
	signOAuthState,
	verifyOAuthState,
} from "../src/lib/auth/google";

describe("Google OAuth utilities", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("isGoogleAuthConfigured", () => {
		it("returns false when env variables are missing", () => {
			delete process.env.GOOGLE_CLIENT_ID;
			delete process.env.GOOGLE_CLIENT_SECRET;
			expect(isGoogleAuthConfigured()).toBe(false);
		});

		it("returns false when only one env variable is present", () => {
			process.env.GOOGLE_CLIENT_ID = "my-client-id";
			delete process.env.GOOGLE_CLIENT_SECRET;
			expect(isGoogleAuthConfigured()).toBe(false);
		});

		it("returns true when both client id and secret are present", () => {
			process.env.GOOGLE_CLIENT_ID = "my-client-id.apps.googleusercontent.com";
			process.env.GOOGLE_CLIENT_SECRET = "GOCSPX-secret123";
			expect(isGoogleAuthConfigured()).toBe(true);
		});
	});

	describe("getAppBaseUrl and getGoogleRedirectUri", () => {
		it("uses APP_URL when configured", () => {
			process.env.APP_URL = "https://siagabencana.id/";
			expect(getAppBaseUrl()).toBe("https://siagabencana.id");
			expect(getGoogleRedirectUri()).toBe("https://siagabencana.id/api/auth/google/callback");
		});

		it("uses NEXT_PUBLIC_APP_URL when configured and APP_URL is absent", () => {
			delete process.env.APP_URL;
			process.env.NEXT_PUBLIC_APP_URL = "https://staging.siagabencana.id";
			expect(getAppBaseUrl()).toBe("https://staging.siagabencana.id");
			expect(getGoogleRedirectUri()).toBe("https://staging.siagabencana.id/api/auth/google/callback");
		});

		it("uses GOOGLE_REDIRECT_URI override when provided", () => {
			process.env.GOOGLE_REDIRECT_URI = "https://custom.siagabencana.id/callback";
			expect(getGoogleRedirectUri()).toBe("https://custom.siagabencana.id/callback");
		});

		it("derives base URL from request headers when env var is absent", () => {
			delete process.env.APP_URL;
			delete process.env.NEXT_PUBLIC_APP_URL;
			delete process.env.GOOGLE_REDIRECT_URI;

			const req = new Request("http://localhost:3000/api/auth/google", {
				headers: {
					"x-forwarded-proto": "https",
					"x-forwarded-host": "posko.siagabencana.id",
				},
			});

			expect(getAppBaseUrl(req)).toBe("https://posko.siagabencana.id");
			expect(getGoogleRedirectUri(req)).toBe("https://posko.siagabencana.id/api/auth/google/callback");
		});
	});

	describe("generateGoogleAuthUrl", () => {
		it("throws an error if GOOGLE_CLIENT_ID is not configured", () => {
			delete process.env.GOOGLE_CLIENT_ID;
			expect(() =>
				generateGoogleAuthUrl({
					redirectUri: "http://localhost:3000/api/auth/google/callback",
					state: "randomstate123",
				}),
			).toThrow("GOOGLE_CLIENT_ID is not configured");
		});

		it("constructs valid Google OAuth authorization URL", () => {
			process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
			const authUrl = generateGoogleAuthUrl({
				redirectUri: "http://localhost:3000/api/auth/google/callback",
				state: "abc123state",
			});

			const parsed = new URL(authUrl);
			expect(parsed.origin).toBe("https://accounts.google.com");
			expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
			expect(parsed.searchParams.get("client_id")).toBe("test-client-id.apps.googleusercontent.com");
			expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");
			expect(parsed.searchParams.get("response_type")).toBe("code");
			expect(parsed.searchParams.get("scope")).toBe("openid email profile");
			expect(parsed.searchParams.get("state")).toBe("abc123state");
			expect(parsed.searchParams.get("prompt")).toBe("select_account");
		});
	});

	describe("OAuth state signing and verification", () => {
		it("signs and successfully verifies payload", () => {
			process.env.GOOGLE_CLIENT_SECRET = "test-secret";
			const signed = signOAuthState({
				state: "state-token-xyz",
				returnTo: "/pengungsi",
			});

			expect(typeof signed).toBe("string");
			const verified = verifyOAuthState(signed);
			expect(verified).not.toBeNull();
			expect(verified?.state).toBe("state-token-xyz");
			expect(verified?.returnTo).toBe("/pengungsi");
		});

		it("rejects tampered state payload", () => {
			process.env.GOOGLE_CLIENT_SECRET = "test-secret";
			const signed = signOAuthState({
				state: "state-token-xyz",
				returnTo: "/pengungsi",
			});

			const parts = signed.split(".");
			const tampered = `eyJyZXR1cm5UbyI6Ii9hZG1pbiJ9.${parts[1]}`;
			expect(verifyOAuthState(tampered)).toBeNull();
		});

		it("rejects malformed token strings", () => {
			expect(verifyOAuthState("")).toBeNull();
			expect(verifyOAuthState("invalid")).toBeNull();
			expect(verifyOAuthState("a.b.c")).toBeNull();
		});
	});
});

