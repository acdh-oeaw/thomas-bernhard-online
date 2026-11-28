import { defineRule } from "@oxlint/plugins";

export const rule = defineRule({
	meta: {
		type: "suggestion",
		schema: [],
		fixable: "code",
		docs: {
			description:
				'Enforce that components imported from `lucide-react` have `aria-hidden` and `data-slot="icon"` props.',
		},
		messages: {
			"icon-props": 'Icons should set `aria-hidden` and `data-slot="icon"` props.',
		},
	},
	create(context) {
		const components = new Set<string>();

		return {
			ImportDeclaration(node): void {
				if (node.source.value !== "lucide-react" || node.importKind === "type") {
					return;
				}

				node.specifiers.forEach((specifier) => {
					components.add(specifier.local.name);
				});
			},
			JSXOpeningElement(node): void {
				if (node.name.type !== "JSXIdentifier") {
					return;
				}
				if (!components.has(node.name.name)) {
					return;
				}

				function hasAttribute(name: string) {
					return node.attributes.some((attribute) => {
						return (
							attribute.type === "JSXAttribute" &&
							attribute.name.type === "JSXIdentifier" &&
							attribute.name.name === name
						);
					});
				}

				const attributes: Array<string> = [];

				if (!hasAttribute("aria-hidden")) {
					attributes.push(" aria-hidden={true}");
				}

				if (!hasAttribute("data-slot")) {
					attributes.push(' data-slot="icon"');
				}

				if (attributes.length > 0) {
					context.report({
						node,
						messageId: "icon-props",
						fix(fixer) {
							return fixer.insertTextAfterRange(
								[node.name.range[1], node.attributes.at(-1)?.range[1] ?? node.name.range[1]],
								attributes.join(""),
							);
						},
					});
				}
			},
		};
	},
});
