import { useLocale } from "next-intl";
import type { ReactNode } from "react";

import { formatDateRange } from "@/lib/date-range";

interface DateRangeProps {
	from?: number | null;
	to?: number | null;
	options?: Intl.DateTimeFormatOptions;
}

/** Format indexed date boundaries using the active UI locale. */
export function DateRange(props: Readonly<DateRangeProps>): ReactNode {
	const { from, to, options } = props;
	const locale = useLocale();
	const date = formatDateRange(from, to, locale, options);
	return date ? <span>{date}</span> : null;
}
