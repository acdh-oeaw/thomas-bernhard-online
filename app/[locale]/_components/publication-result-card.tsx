import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { DateRange } from "#/components/date-range.tsx";
import { useLanguageLabel } from "#/components/language-label.tsx";
import { HighlightedSnippet } from "#/components/typesense/index.ts";
import { type SearchDisplayMode, searchResultRelationLimits } from "#/config/ui.ts";
import type { PublicationSearchDocument } from "#/lib/data.ts";
import { translationLabel } from "#/lib/translation-label.ts";

import { type ResultCardField, resultCardValues, SearchResultCard } from "./search-result-card.tsx";

export function PublicationResultCard(
	props: Readonly<{
		hit: SearchResponseHit<PublicationSearchDocument & { type?: "manifestation" }>;
		displayMode: SearchDisplayMode;
	}>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const language = useLanguageLabel(document.language, true);
	const translations = (document.contained_translations ?? []).map(translationLabel);
	const title = highlight.title;
	const markup = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;
	const cardMetadata: Array<ResultCardField> = [
		{ label: t("publisher"), values: document.publisher?.name ? [document.publisher.name] : [] },
		{
			label: t("contains"),
			...resultCardValues(
				translations,
				searchResultRelationLimits.translations,
				document.translations_count,
			),
		},
	];
	const listMetadata: Array<ResultCardField> = [
		{ label: t("language"), values: language ? [language] : [] },
		...cardMetadata,
		{ label: t("isbn"), values: document.isbn == null ? [] : [String(document.isbn)] },
		{ label: t("source"), values: document.source ? [document.source] : [] },
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="manifestation"
			header={markup ? <HighlightedSnippet snippet={markup} /> : document.title}
			href={`/publication/${document.id}`}
			image="publication"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
			subheader={
				<DateRange
					from={document.publication_date_from}
					options={{ year: "numeric" }}
					to={document.publication_date_to}
				/>
			}
			summary={document.subtitle}
			tags={language ? [{ label: t("language"), value: language }] : []}
		/>
	);
}
