import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { useLanguageLabel } from "#/components/language-label.tsx";
import { HighlightedSnippet } from "#/components/typesense/index.ts";
import { type SearchDisplayMode, searchResultRelationLimits } from "#/config/ui.ts";
import type { UniversalSearchDocument } from "#/lib/data.ts";

import { type ResultCardField, resultCardValues, SearchResultCard } from "./search-result-card.tsx";

type Translation = Extract<UniversalSearchDocument, { type: "translation" }>;

export function TranslationResultCard(
	props: Readonly<{ hit: SearchResponseHit<Translation>; displayMode: SearchDisplayMode }>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const language = useLanguageLabel(document.language, true);
	const title = highlight.title;
	const markup = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;
	const work = document.work;
	const original = work
		? `${work.title}${work.year == null ? "" : ` (${String(work.year)})`}`
		: undefined;
	const translators = (document.authors ?? []).map((person) => {
		return person.name;
	});
	const publications = (document.manifestations ?? []).map((publication) => {
		return publication.title;
	});
	const attributes: Array<ResultCardField> = [
		{
			label: t("language"),
			values: language ? [language] : [],
		},
	];
	const cardMetadata: Array<ResultCardField> = [
		{ label: t("original-work"), values: original ? [original] : [] },
		{
			label: t("translators"),
			...resultCardValues(translators, 2, document.authors_count),
		},
	];
	const listMetadata: Array<ResultCardField> = [
		...attributes,
		{ label: t("original-work"), values: original ? [original] : [] },
		{
			label: t("translators"),
			...resultCardValues(translators, searchResultRelationLimits.authors, document.authors_count),
		},
		{
			label: t("published-in"),
			...resultCardValues(
				publications,
				searchResultRelationLimits.manifestations,
				document.manifestations_count,
			),
		},
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="translation"
			header={markup ? <HighlightedSnippet snippet={markup} /> : document.title}
			href={`/translation/${document.id}`}
			image="translation"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
			subheader={document.year}
			tags={language ? [{ label: t("language"), value: language }] : []}
		/>
	);
}
