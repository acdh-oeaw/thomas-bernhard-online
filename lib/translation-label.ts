import type { Translation, Work } from "#/lib/data.ts";

/** A translation reference includes the original work's title when available. */
export function translationLabel(
	translation: Pick<Translation, "title"> & { work?: Pick<Work, "title"> | null },
): string {
	const { title, work } = translation;
	if (work == null) return title;
	return `${title} [${work.title}]`;
}
