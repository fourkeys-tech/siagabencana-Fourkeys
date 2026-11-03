import { resolveTestDatabaseUrl } from "./db-guard";

// Dijalankan sebelum file test meng-import @/lib/prisma, jadi client selalu terhubung ke DB test.
// Validasi dilakukan di sini (sebelum override) karena setelahnya DATABASE_URL sengaja sama dengan TEST_DATABASE_URL.
const url = resolveTestDatabaseUrl();
if (url) {
	process.env.DATABASE_URL = url;
	process.env.INTEGRATION_DB_READY = "1";
} else {
	// Tanpa DB test: suite di-skip. DATABASE_URL diganti alamat mati supaya DB lain (mis. prod di shell) tidak pernah tersentuh.
	process.env.DATABASE_URL = "postgresql://skip:skip@127.0.0.1:1/skip";
}
