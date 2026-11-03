import { execSync } from "node:child_process";
import { resolveTestDatabaseUrl } from "./db-guard";

export default function setup() {
	const url = resolveTestDatabaseUrl();
	if (!url) {
		console.warn("[integration] TEST_DATABASE_URL tidak di-set, test integrasi di-skip.");
		return;
	}

	// DATABASE_URL di-override sebelum prisma.config.ts memuat .env (dotenv tidak menimpa env yang sudah ada).
	execSync("npx prisma migrate deploy", {
		stdio: "inherit",
		env: { ...process.env, DATABASE_URL: url },
	});
}
