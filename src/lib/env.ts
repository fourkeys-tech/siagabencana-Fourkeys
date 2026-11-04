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

/**
 * pg 8.x sudah memperlakukan sslmode prefer/require/verify-ca sebagai verify-full, tapi mencetak
 * SECURITY WARNING setiap kali koneksi dibuat. Menuliskan verify-full secara eksplisit mempertahankan
 * perilaku yang sama persis (sertifikat + hostname diverifikasi), menghilangkan warning, dan mengunci
 * keamanan saat pg v9 nanti mengubah arti "require" menjadi lebih lemah.
 */
export function withExplicitSslMode(url: string): string {
	return url.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|#|$)/i, "$1verify-full");
}

export function isProduction(): boolean {
	return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/** Kredensial service account Google (sekali per server). Spreadsheet tujuan diatur per akun di Pengaturan. */
export function isGoogleServiceAccountConfigured(): boolean {
	return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim());
}

export function isGoogleAuthConfigured(): boolean {
	return Boolean(
		process.env.GOOGLE_CLIENT_ID?.trim() &&
		process.env.GOOGLE_CLIENT_SECRET?.trim(),
	);
}

export function getCronSecret(): string | null {
	return process.env.CRON_SECRET?.trim() || null;
}
