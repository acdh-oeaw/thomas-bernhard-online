import type { CSSProperties } from "react";

import type { CollectionName } from "#/lib/typesense/search.ts";

/** Shared brand hues for the API collections and the combined search tab. */
export const entityBrandHues = {
	work: 35,
	person: 85,
	group: 140,
	translation: 190,
	publication: 240,
	performance: 290,
	event: 20,
	all: 335,
} as const satisfies Record<CollectionName | "all", number>;

/** Works use a monochrome treatment to stand apart from the other entities. */
export const workBrandColors = {
	foreground: "light-dark(#000000, #ffffff)",
	background: "light-dark(#ffffff, #000000)",
	secondaryText: "light-dark(#404040, #d4d4d4)",
} as const;

/** Keep the same hue while adapting foreground contrast to the active color scheme. */
export function entityBrandStyle(
	collection: keyof typeof entityBrandHues,
): CSSProperties & Record<`--${string}`, string> {
	if (collection === "work") {
		return {
			"--entity-brand-color": workBrandColors.foreground,
			"--entity-brand-tint": workBrandColors.background,
			"--entity-brand-border": workBrandColors.foreground,
			"--entity-brand-outline": workBrandColors.foreground,
			"--color-text-strong": workBrandColors.foreground,
			"--color-text-weak": workBrandColors.secondaryText,
		};
	}
	const hue = entityBrandHues[collection];
	return {
		"--entity-brand-color": `light-dark(oklch(45% 0.11 ${String(hue)}), oklch(80% 0.11 ${String(hue)}))`,
		"--entity-brand-tint":
			"color-mix(in oklch, var(--entity-brand-color) 8%, var(--color-background-raised))",
		"--entity-brand-border": "var(--color-stroke-weak)",
		"--entity-brand-outline": "transparent",
	};
}

export const searchDisplayModes = ["list", "card"] as const;

export type SearchDisplayMode = (typeof searchDisplayModes)[number];

/** Maximum examples needed by either result layout, shared with the union JOIN projections. */
export const searchResultRelationLimits = {
	languages: 4,
	translations: 4,
	performances: 4,
	events: 4,
	theaters: 4,
	authors: 4,
	manifestations: 3,
	publications: 4,
} as const;
