import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { PublicationSearchDocument } from "@/lib/data";
import { publicationDateRange } from "@/lib/publication-date";
import { translationLabel } from "@/lib/translation-label";

import { ResultCardSummary } from "./result-card-summary";
import { type ResultCardField, SearchResultCard } from "./search-result-card";

export function PublicationResultCard(
	props: Readonly<{
		hit: SearchResponseHit<PublicationSearchDocument & { type?: "manifestation" }>;
		displayMode: SearchDisplayMode;
	}>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const translations = (document.expressions ?? []).map((translation, index) => {
		const label = translationLabel(translation);
		return { id: `${label}:${String(index)}`, content: label };
	});
	const title = highlight.title;
	const markup = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;
	const cardMetadata: Array<ResultCardField> = [
		{
			label: t("language"),
			value: document.language ? <LanguageLabel code={document.language} expand={true} /> : null,
			isTag: true,
		},
		{ label: t("publisher"), value: document.publisher?.name },
		{
			label: t("contains"),
			value: translations.length ? <ResultCardSummary limit={4} values={translations} /> : null,
		},
	];
	const listMetadata: Array<ResultCardField> = [
		...cardMetadata,
		{ label: t("isbn"), value: document.isbn },
		{ label: t("source"), value: document.source },
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="manifestation"
			header={markup ? <HighlightedSnippet snippet={markup} /> : document.title}
			href={`/publication/${document.id}`}
			image="publication"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
			subheader={publicationDateRange(document)}
			summary={document.subtitle}
		/>
	);
}
