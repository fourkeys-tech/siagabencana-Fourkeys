// Guard keamanan: test integrasi hanya boleh menyentuh DB test yang eksplisit, tidak pernah DATABASE_URL (prod).
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function resolveTestDatabaseUrl(env: Record<string, string | undefined> = process.env) {
	const testUrl = env.TEST_DATABASE_URL?.trim();
	if (!testUrl) return null;

	if (env.DATABASE_URL && env.DATABASE_URL.trim() === testUrl) {
		throw new Error("TEST_DATABASE_URL tidak boleh sama dengan DATABASE_URL.");
	}

	let host: string;
	try {
		host = new URL(testUrl).hostname;
	} catch {
		throw new Error("TEST_DATABASE_URL bukan URL Postgres yang valid.");
	}

	if (!LOCAL_HOSTS.has(host) && env.TEST_DATABASE_ALLOW_REMOTE !== "1") {
		throw new Error("TEST_DATABASE_URL harus mengarah ke localhost. Set TEST_DATABASE_ALLOW_REMOTE=1 untuk DB test remote yang terpisah.");
	}

	return testUrl;
}
