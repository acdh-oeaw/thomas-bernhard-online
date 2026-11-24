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
	const cardMetadata: Array<ResultCardField> = [
		{
			label: t("identifiers"),
			value: document.sameas.length ? <ResultCardSummary limit={1} values={identifiers} /> : null,
		},
	];
	const listMetadata: Array<ResultCardField> = [
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
