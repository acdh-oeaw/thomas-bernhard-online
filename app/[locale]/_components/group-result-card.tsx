import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import { type SearchDisplayMode, searchResultRelationLimits } from "@/config/ui";
import type { UniversalSearchDocument } from "@/lib/data";

import { type ResultCardField, resultCardValues, SearchResultCard } from "./search-result-card";

type Group = Extract<UniversalSearchDocument, { type: "group" }>;
type GroupHit = SearchResponseHit<Group>;

function highlightMarkup(hit: GroupHit): string | undefined {
	const nameHighlight = hit.highlight.name;

	if (nameHighlight != null && "value" in nameHighlight) {
		return nameHighlight.value ?? nameHighlight.snippet;
	}

	return undefined;
}

export function GroupResultCard(
	props: Readonly<{ hit: GroupHit; displayMode: SearchDisplayMode }>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document } = hit;
	const t = useTranslations("ResultCard");
	const performances = (document.performances ?? []).map((performance) => {
		const date = performance.date_range;
		return `${performance.title}${date ? ` (${date})` : ""}`;
	});
	const publications = (document.publications ?? []).map((publication) => {
		return publication.title;
	});
	const events = (document.events ?? []).map((event) => {
		const date = event.date_range;
		return `${event.title}${date ? ` (${date})` : ""}`;
	});
	const cardMetadata: Array<ResultCardField> = [
		{
			label: t("performances"),
			...resultCardValues(performances, 2, document.performances_count),
		},
		{ label: t("events"), ...resultCardValues(events, 2, document.events_count) },
		{
			label: t("publications"),
			...resultCardValues(publications, 2, document.publications_count),
		},
	];
	const listMetadata: Array<ResultCardField> = [
		{
			label: t("performances"),
			...resultCardValues(
				performances,
				searchResultRelationLimits.performances,
				document.performances_count,
			),
		},
		{
			label: t("events"),
			...resultCardValues(events, searchResultRelationLimits.events, document.events_count),
		},
		{
			label: t("publications"),
			...resultCardValues(
				publications,
				searchResultRelationLimits.publications,
				document.publications_count,
			),
		},
	];
	const nameHighlight = highlightMarkup(hit);

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="group"
			header={
				nameHighlight != null ? <HighlightedSnippet snippet={nameHighlight} /> : document.name
			}
			href={`/group/${document.id}`}
			image="group"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
		/>
	);
}
