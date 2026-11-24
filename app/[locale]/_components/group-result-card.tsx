import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { UniversalSearchDocument } from "@/lib/data";

import { ResultCardSummary } from "./result-card-summary";
import { type ResultCardField, SearchResultCard } from "./search-result-card";

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
	const identifiers = document.sameas.map((identifier) => {
		return { id: identifier, content: identifier };
	});
	const performances = (document.performances ?? []).map((performance, index) => {
		return {
			id: `${performance.title}:${String(index)}`,
			content: `${performance.title}${performance.date_range ? ` (${performance.date_range})` : ""}`,
		};
	});
	const publications = (document.publications ?? []).map((publication, index) => {
		return { id: `${publication.title}:${String(index)}`, content: publication.title };
	});
	const cardMetadata: Array<ResultCardField> = [
		{
			label: t("performances"),
			value: performances.length ? <ResultCardSummary limit={2} values={performances} /> : null,
		},
		{
			label: t("publications"),
			value: publications.length ? <ResultCardSummary limit={2} values={publications} /> : null,
		},
		{
			label: t("identifiers"),
			value: document.sameas.length ? <ResultCardSummary limit={1} values={identifiers} /> : null,
		},
	];
	const listMetadata: Array<ResultCardField> = [
		{
			label: t("performances"),
			value: performances.length ? <ResultCardSummary limit={4} values={performances} /> : null,
		},
		{
			label: t("publications"),
			value: publications.length ? <ResultCardSummary limit={4} values={publications} /> : null,
		},
		{
			label: t("identifiers"),
			value: document.sameas.length ? <ResultCardSummary limit={3} values={identifiers} /> : null,
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
