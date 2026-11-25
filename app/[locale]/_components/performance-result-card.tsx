"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import { type SearchDisplayMode, searchResultRelationLimits } from "@/config/ui";
import type { PerformanceSearchDocument } from "@/lib/data";

import { type ResultCardField, resultCardValues, SearchResultCard } from "./search-result-card";

export function PerformanceResultCard(
	props: Readonly<{
		hit: SearchResponseHit<PerformanceSearchDocument>;
		displayMode: SearchDisplayMode;
	}>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const title = highlight.title;
	const markup = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;
	const directors = (document.directors ?? []).flatMap((person) => {
		return person.name ? [person.name] : [];
	});
	const actors = (document.actors ?? []).flatMap((person) => {
		return person.name ? [person.name] : [];
	});
	const theaters = (document.theaters ?? []).map((theater) => {
		return theater.name;
	});
	const work = document.work;
	const original = work
		? `${work.title}${work.year == null ? "" : ` (${String(work.year)})`}`
		: undefined;
	const metadata: Array<ResultCardField> = [
		{ label: t("original-work"), values: original ? [original] : [] },
		{
			label: t("theaters"),
			...resultCardValues(
				theaters,
				displayMode === "card" ? 2 : searchResultRelationLimits.theaters,
				document.theaters_count,
			),
		},
		{ label: t("directors"), ...resultCardValues(directors, displayMode === "card" ? 2 : 4) },
		{ label: t("actors"), ...resultCardValues(actors, displayMode === "card" ? 2 : 4) },
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="performance"
			header={markup ? <HighlightedSnippet snippet={markup} /> : document.title}
			href={`/performance/${document.id}`}
			image="performance"
			metadata={metadata}
			subheader={document.date_range}
		/>
	);
}
