import type { Config } from "stylelint";

const config: Config = {
	extends: "@acdh-oeaw/stylelint-config",
	rules: {
		"at-rule-prelude-no-invalid": [
			true,
			{
				ignoreAtRules: ["apply"],
			},
		],
	},
};

export default config;
