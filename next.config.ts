import localesPlugin from "@react-aria/optimize-locales-plugin";
import type { NextConfig as Config } from "next";
import createI18nPlugin from "next-intl/plugin";

import { env } from "#/config/env.config.ts";

const config: Config = {
	// cacheComponents: true,
	/** Compression should be handled by traefik reverse proxy. */
	compress: false,
	experimental: {
		globalNotFound: true,
		strictRouteTypes: true,
		turbopackRustReactCompiler: true,
	},
	logging: {
		fetches: {
			fullUrl: true,
		},
	},
	output: env.BUILD_MODE,
	// partialPrefetching: true,
	reactCompiler: true,
	turbopack: {
		rules: {
			"*.css": {
				loaders: ["@tailwindcss/turbopack"],
			},
			...localesPlugin.turbopack([{ condition: "browser", locales: [] }]).rules,
		},
	},
	typedRoutes: false,
	typescript: {
		ignoreBuildErrors: true,
	},
};

const plugins: Array<(config: Config) => Config> = [
	createI18nPlugin({
		experimental: {
			/** @see https://next-intl.dev/docs/workflows/typescript#messages-arguments */
			createMessagesDeclaration: ["./content/en/metadata/index.json", "./messages/en.json"],
		},
		requestConfig: "./lib/i18n/request.ts",
	}),
];

export default plugins.reduce((config, plugin) => {
	return plugin(config);
}, config);
