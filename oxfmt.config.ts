import { defineConfig } from "oxfmt";

export default defineConfig({
	endOfLine: "lf",
	ignorePatterns: ["pnpm-lock.yaml", "pnpm-workspace.yaml", "content/", "public/"],
	jsdoc: true,
	printWidth: 100,
	sortImports: {
		groups: [
			"side_effect",
			"side_effect_style",
			"builtin",
			"external",
			["internal", "subpath"],
			["parent", "sibling", "index"],
			"style",
			"unknown",
		],
		internalPattern: ["#"],
		newlinesBetween: true,
	},
	sortPackageJson: {
		sortScripts: true,
	},
	sortTailwindcss: {
		functions: ["cn", "styles"],
		stylesheet: "./styles/index.css",
	},
	tabWidth: 2,
	useTabs: true,
});
