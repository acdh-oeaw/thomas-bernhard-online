import { timeZone } from "#/lib/i18n/locales.ts";

/** Convert indexed Unix seconds or milliseconds only when a date is formatted. */
function timestampDate(value: number | null | undefined): Date | undefined {
	if (value == null || !Number.isFinite(value)) return undefined;
	const date = new Date(Math.abs(value) < 10_000_000_000 ? value * 1000 : value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Locale-aware dates, collapsing equal days (or equal years with year-only options). */
export function formatDateRange(
	from: number | null | undefined,
	to: number | null | undefined,
	locale: string,
	options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
	const start = timestampDate(from);
	const end = timestampDate(to);
	if (start == null && end == null) return "";

	const formatter = new Intl.DateTimeFormat(locale, { timeZone, ...options });
	if (start == null) return formatter.format(end);
	if (end == null) return formatter.format(start);
	if (formatter.format(start) === formatter.format(end)) return formatter.format(start);
	return start <= end ? formatter.formatRange(start, end) : formatter.formatRange(end, start);
}
