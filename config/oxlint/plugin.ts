import { definePlugin, defineRule } from "@oxlint/plugins";

import { rule as icons } from "./icons.ts";

export default definePlugin({
	rules: {
		icons,
		"no-process-env": defineRule({
			create(context) {
				return {
					MemberExpression(node) {
						if (
							!node.computed &&
							node.object.type === "Identifier" &&
							node.object.name === "process" &&
							node.property.type === "Identifier" &&
							node.property.name === "env"
						) {
							context.report({
								node,
								message: "Please use `#/config/env.config.ts` instead.",
							});
						}
					},
				};
			},
		}),
	},
});
