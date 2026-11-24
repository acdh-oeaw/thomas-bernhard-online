import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { UniversalSearchDocument } from "@/lib/data";
import { translationLabel } from "@/lib/translation-label";

import { ResultCardSummary } from "./result-card-summary";
import { type ResultCardField, SearchResultCard } from "./search-result-card";

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
	const identifiers = document.sameas.map((identifier) => {
		return { id: identifier, content: identifier };
	});
	const translations = (document.expressions ?? []).map((translation, index) => {
		const label = translationLabel(translation);
		return { id: `${label}:${String(index)}`, content: label };
	});
	const cardMetadata: Array<ResultCardField> = [
		{
			label: t("translations"),
			value: translations.length ? <ResultCardSummary limit={2} values={translations} /> : null,
		},
		{
			label: t("identifiers"),
			value: document.sameas.length ? <ResultCardSummary limit={1} values={identifiers} /> : null,
		},
	];
	const listMetadata: Array<ResultCardField> = [
		{
			label: t("translations"),
			value: translations.length ? <ResultCardSummary limit={4} values={translations} /> : null,
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
