"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "#/components/typesense/index.ts";
import { type SearchDisplayMode, searchResultRelationLimits } from "#/config/ui.ts";
import type { WorkSearchDocument } from "#/lib/data.ts";

import { type ResultCardField, resultCardValues, SearchResultCard } from "./search-result-card.tsx";

type WorkHit = SearchResponseHit<WorkSearchDocument & { type?: "work" }>;
type FieldHighlight = { snippet?: string; value?: string } | undefined;

function fieldMarkup(highlight: WorkHit["highlight"], field: string): string | undefined {
	const value = (highlight as Record<string, FieldHighlight>)[field];
	return value?.value ?? value?.snippet;
}

export function WorkResultCard(
	props: Readonly<{ hit: WorkHit; displayMode: SearchDisplayMode }>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const tWork = useTranslations("WorkPage");
	const title = fieldMarkup(highlight, "title");
	const locale = useLocale();
	const languageNames = new Intl.DisplayNames([locale], { type: "language" });
	const translations = document.translations ?? [];
	const languages = [
		...new Set(
			translations.map(({ language }) => {
				return language;
			}),
		),
	]
		.map((code) => {
			try {
				return languageNames.of(code) ?? code;
			} catch {
				return code;
			}
		})
		.sort((a, b) => {
			return a.localeCompare(b, locale);
		});
	const { values: visibleLanguages, more: moreLanguages } = resultCardValues(
		languages,
		displayMode === "card" ? 2 : searchResultRelationLimits.languages,
	);
	const performances = document.performances ?? [];
	const events = document.events ?? [];
	const performanceCount = document.performances_count ?? performances.length;
	const eventCount = document.events_count ?? events.length;
	const performanceVenueCount = new Set(
		performances.flatMap((performance) => {
			return performance.theater_ids ?? [];
		}),
	).size;
	const eventVenueCount = new Set(
		events.flatMap((event) => {
			return event.location_id ? [event.location_id] : [];
		}),
	).size;
	const metadata: Array<ResultCardField> = [
		{
			label: t("translation-count", { count: document.translations_count ?? translations.length }),
			labelSeparator: " ",
			values: visibleLanguages,
			suffix: moreLanguages == null ? undefined : t("more-languages", { count: moreLanguages }),
		},
		{
			label: t("performance-count", { count: performanceCount }),
			labelSeparator: " ",
			values: performanceCount > 0 ? [t("at-venues", { count: performanceVenueCount })] : [],
		},
		{
			label: t("event-count", { count: eventCount }),
			labelSeparator: " ",
			values: eventCount > 0 ? [t("at-venues", { count: eventVenueCount })] : [],
		},
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="work"
			header={title ? <HighlightedSnippet snippet={title} /> : document.title || tWork("untitled")}
			href={`/work/${document.id}`}
			image="work"
			metadata={
				displayMode === "list"
					? [
							{ label: t("category"), values: document.category ? [document.category] : [] },
							...metadata,
						]
					: metadata
			}
			subheader={document.year}
			tags={document.category ? [{ label: t("category"), value: document.category }] : []}
		/>
	);
}
