export function getDatabaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL is not set in environment.");
	}
	if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
		throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
	}
	return url;
}

export function isProduction(): boolean {
	return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function isGoogleSheetsConfigured(): boolean {
	return Boolean(
		process.env.GOOGLE_SPREADSHEET_ID &&
		process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
	);
}

export function getCronSecret(): string | null {
	return process.env.CRON_SECRET ?? null;
}
