import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";

import { defineConfig, devices } from "@playwright/test";
import isCI from "is-in-ci";

/** Load env files here so the VS Code Playwright extension gets them too. */
for (const envFilePath of [".env.test.local", ".env.local", ".env.test", ".env"]) {
	const path = join(process.cwd(), envFilePath);
	if (existsSync(path)) {
		loadEnvFile(path);
	}
}

const port = 3000;
const baseUrl = `http://localhost:${String(port)}`;

export default defineConfig({
	testDir: "../e2e",
	snapshotDir: "../e2e/snapshots",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	maxFailures: 10,
	workers: isCI ? 1 : undefined,
	reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["html"]],
	use: {
		baseURL: baseUrl,
		screenshot: "on-first-failure",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], channel: "chromium" },
		},
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},
		/** Test against mobile viewports. */
		// {
		// 	name: "Mobile Chrome",
		// 	use: { ...devices["Pixel 5"] },
		// },
		// {
		// 	name: "Mobile Safari",
		// 	use: { ...devices["iPhone 12"] },
		// },
		/** Test against branded browsers. */
		// {
		// 	name: "Microsoft Edge",
		// 	use: { ...devices["Desktop Edge"], channel: "msedge" },
		// },
		// {
		// 	name: "Google Chrome",
		// 	use: { ...devices["Desktop Chrome"], channel: "chrome" },
		// },
	],
	webServer: {
		/**
		 * The standalone output that the `Dockerfile` serves, not `next start`, which runs from the
		 * project folder.
		 */
		command: "pnpm run build && pnpm run start:standalone",
		cwd: "..",
		env: {
			BUILD_MODE: "standalone",
			/**
			 * Not a loopback ip like 127.0.0.1, which breaks the rewrites of the i18n proxy.
			 *
			 * @see {@link https://github.com/vercel/next.js/issues/94745}
			 */
			HOSTNAME: "0.0.0.0",
			PORT: String(port),
		},
		url: baseUrl,
		timeout: 5 * 60 * 1000,
		reuseExistingServer: !isCI,
	},
});
