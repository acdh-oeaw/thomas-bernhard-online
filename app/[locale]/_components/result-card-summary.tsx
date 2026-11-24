import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";

export interface ResultCardSummaryItem {
	id: string;
	content: ReactNode;
}

/** Keep long relationships as text, with a consistent abbreviation in both layouts. */
export function ResultCardSummary(
	props: Readonly<{ values: ReadonlyArray<ResultCardSummaryItem>; limit: number }>,
): ReactNode {
	const { values, limit } = props;
	const t = useTranslations("ResultCard");
	if (values.length === 0) return null;

	return (
		<>
			{values.slice(0, limit).map(({ id, content }, index) => {
				return (
					<Fragment key={id}>
						{index > 0 ? ", " : null}
						{content}
					</Fragment>
				);
			})}
			{values.length > limit ? ` ${t("more", { count: String(values.length - limit) })}` : null}
		</>
	);
}
