import type { Expression, Work } from "@/lib/data";

/** A translation reference includes the original work's title and year when available. */
export function translationLabel(
	translation: Pick<Expression, "title"> & { work?: Pick<Work, "title" | "year"> | null },
): string {
	const { title, work } = translation;
	if (work == null) return title;
	const original = work.year == null ? work.title : `${work.title} (${String(work.year)})`;
	return `${title} [${original}]`;
}
