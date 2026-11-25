import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface ValueListProps {
	values: ReadonlyArray<string>;
	/** Number of additional values omitted from the list. */
	more?: number;
	separator?: string;
}

export function ValueList(props: Readonly<ValueListProps>): ReactNode {
	const { values, more, separator = ", " } = props;
	const t = useTranslations("ValueList");
	const occurrences = new Map<string, number>();
	const items = values.map((value) => {
		const occurrence = occurrences.get(value) ?? 0;
		occurrences.set(value, occurrence + 1);
		return { value, key: JSON.stringify([value, occurrence]) };
	});

	if (items.length === 0 && more == null) return null;

	return (
		<ul className="m-0 inline list-none p-0" role="list">
			{items.map(({ value, key }, index) => {
				return (
					<li key={key} className="inline">
						{index > 0 ? <span aria-hidden={true}>{separator}</span> : null}
						<span className="rounded-1 bg-fill-weak box-decoration-clone px-1 py-0.5 text-text-strong">
							{value}
						</span>
					</li>
				);
			})}
			{more != null ? (
				<li className="inline">
					{items.length > 0 ? " " : null}
					<span className="whitespace-nowrap text-text-weak">{t("more", { count: more })}</span>
				</li>
			) : null}
		</ul>
	);
}
