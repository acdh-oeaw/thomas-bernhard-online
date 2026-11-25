import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import { type SearchDisplayMode, searchResultRelationLimits } from "@/config/ui";
import type { UniversalSearchDocument } from "@/lib/data";
import { translationLabel } from "@/lib/translation-label";

import { type ResultCardField, resultCardValues, SearchResultCard } from "./search-result-card";

type Person = Extract<UniversalSearchDocument, { type: "person" }>;
type PersonHit = SearchResponseHit<Person>;

function highlightMarkup(hit: PersonHit): string | undefined {
	const nameHighlight = hit.highlight.name;

	if (nameHighlight != null && "value" in nameHighlight) {
		return nameHighlight.value ?? nameHighlight.snippet;
	}

	return undefined;
}

export function PersonResultCard(
	props: Readonly<{ hit: PersonHit; displayMode: SearchDisplayMode }>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document } = hit;
	const t = useTranslations("ResultCard");
	const translations = (document.translations ?? []).map(translationLabel);
	const cardMetadata: Array<ResultCardField> = [
		{
			label: t("translations"),
			...resultCardValues(translations, 2, document.translations_count),
		},
	];
	const listMetadata: Array<ResultCardField> = [
		{
			label: t("translations"),
			...resultCardValues(
				translations,
				searchResultRelationLimits.translations,
				document.translations_count,
			),
		},
	];
	const nameHighlight = highlightMarkup(hit);

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="person"
			header={
				nameHighlight != null ? <HighlightedSnippet snippet={nameHighlight} /> : document.name
			}
			href={`/person/${document.id}`}
			image="person"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
		/>
	);
}
