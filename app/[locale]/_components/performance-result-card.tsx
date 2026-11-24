"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { Performance } from "@/lib/data";

import { SearchResultCard } from "./search-result-card";

export function PerformanceResultCard(
	props: Readonly<{ hit: SearchResponseHit<Performance>; displayMode: SearchDisplayMode }>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("PerformanceResultCard");
	const title = highlight.title;
	const snippet = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;
	const people = [{ label: t("participants"), names: document.participant_ids }];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="performance"
			header={snippet != null ? <HighlightedSnippet snippet={snippet} /> : document.title}
			href={`/performance/${document.id}`}
			image="performance"
			subheader={document.date_range}
		>
			<div className="grid gap-y-2 text-small text-text-weak">
				{people.map(({ label, names }) => {
					return names?.length ? (
						<p key={label}>
							<span className="font-strong">
								{label}
								{": "}
							</span>
							{names
								.map((person) => {
									return person.name;
								})
								.filter(Boolean)
								.join(", ")}
						</p>
					) : null;
				})}
			</div>
		</SearchResultCard>
	);
}
