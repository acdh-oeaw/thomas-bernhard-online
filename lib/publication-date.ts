import type { Manifestation } from "@/lib/data";

/** Publication dates use Unix timestamps, like performance dates. Accept seconds or milliseconds. */
export function publicationDateRange(
	publication: Pick<Manifestation, "publication_date_from" | "publication_date_to">,
): string {
	const year = (value: number): string => {
		const date = new Date(Math.abs(value) < 10_000_000_000 ? value * 1000 : value);
		return Number.isNaN(date.getTime()) ? "" : String(date.getUTCFullYear());
	};
	const from = year(publication.publication_date_from);
	const to = year(publication.publication_date_to);
	return from && to && from !== to ? `${from}–${to}` : from || to;
}
