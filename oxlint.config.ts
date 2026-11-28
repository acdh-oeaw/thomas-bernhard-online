import { defineConfig } from "oxlint";

export default defineConfig({
	env: { browser: true, node: true },
	ignorePatterns: ["content/", "public/"],
	plugins: ["eslint", "typescript", "oxc", "unicorn", "react", "jsx-a11y", "nextjs", "import"],
	jsPlugins: [{ name: "app", specifier: "./config/oxlint/plugin.ts" }],
	options: {
		reportUnusedDisableDirectives: "error",
		typeAware: true,
	},
	rules: {
		"app/icons": "error",
		"app/no-process-env": "error",
		"arrow-body-style": ["error", "always"],
		"import/extensions": ["error", "always", { ignorePackages: true, checkTypeImports: true }],
		// Tailwind Preflight removes list markers. An explicit role preserves list semantics in WebKit.
		"jsx-a11y/no-redundant-roles": ["warn", { ul: ["list"] }],
		"nextjs/no-img-element": "error",
		"no-restricted-imports": [
			"error",
			{
				paths: [
					{
						name: "next/image",
						allowImportNames: ["StaticImageData"],
						message: "Please use `#/components/image.tsx` instead.",
					},
					{
						name: "next/link",
						allowImportNames: ["useLinkStatus"],
						message: "Please use `#/components/link.tsx` instead.",
					},
					{
						name: "next/navigation",
						importNames: [
							"permanentRedirect",
							"redirect",
							"usePathname",
							"useRouter",
							"useSearchParams",
						],
						message: "Please use `#/lib/navigation/navigation.ts` instead.",
					},
					{
						name: "next/router",
						message: "Please use `#/lib/navigation/navigation.ts` instead.",
					},
				],
			},
		],
		"react/jsx-no-literals": [
			"error",
			{
				allowedStrings: [
					"&amp;",
					"&apos;",
					"&copy;",
					"&gt;",
					"&lt;",
					"&nbsp;",
					"&quot;",
					"&rarr;",
					"&larr;",
					"&mdash;",
					"&ndash;",
					".",
					"!",
					":",
					";",
					",",
					"-",
					"(",
					")",
					"|",
					"/",
				],
			},
		],
		"react/no-danger": "error",
		"react/rules-of-hooks": "error",
		"typescript/no-explicit-any": "error",
		"typescript/no-invalid-void-type": "error",
		"typescript/no-unnecessary-condition": "error",
		"typescript/no-unsafe-argument": "error",
		"typescript/no-unsafe-call": "error",
		"typescript/no-unsafe-member-access": "error",
		"typescript/no-unsafe-return": "error",
		"typescript/prefer-optional-chain": "error",
		"typescript/require-array-sort-compare": "error",
		"typescript/restrict-template-expressions": "error",
	},
	overrides: [
		{
			files: ["e2e/**/*.ts"],
			jsPlugins: [{ name: "playwright", specifier: "eslint-plugin-playwright" }],
			rules: {
				"playwright/missing-playwright-await": "error",
				"playwright/no-focused-test": "error",
				"playwright/no-skipped-test": "warn",
				"playwright/prefer-web-first-assertions": "error",
			},
		},
	],
});
