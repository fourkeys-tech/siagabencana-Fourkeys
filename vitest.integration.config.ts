import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/integration/**/*.test.ts"],
		globals: false,
		globalSetup: ["tests/integration/global-setup.ts"],
		setupFiles: ["tests/integration/setup.ts"],
		fileParallelism: false,
		testTimeout: 30_000,
		hookTimeout: 60_000,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
