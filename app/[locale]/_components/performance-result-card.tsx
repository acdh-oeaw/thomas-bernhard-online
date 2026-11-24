"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { PerformanceSearchDocument } from "@/lib/data";

import { ResultCardSummary } from "./result-card-summary";
import { type ResultCardField, SearchResultCard } from "./search-result-card";

export function PerformanceResultCard(
	props: Readonly<{
		hit: SearchResponseHit<PerformanceSearchDocument>;
		displayMode: SearchDisplayMode;
	}>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const identifiers = document.sameas.map((identifier) => {
		return { id: identifier, content: identifier };
	});
	const title = highlight.title;
	const markup = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;
	const participants = (document.participant_ids ?? []).flatMap((person) => {
		return person.name ? [{ id: person.id ?? person.name, content: person.name }] : [];
	});
	const work = document.work;
	const original = work
		? `${work.title}${work.year == null ? "" : ` (${String(work.year)})`}`
		: undefined;
	const relations: Array<ResultCardField> = [
		{ label: t("original-work"), value: original },
		{ label: t("location"), value: document.location?.name },
	];
	const cardMetadata: Array<ResultCardField> = [
		{ label: t("event-type"), value: document.type_of_event, isTag: true },
		...relations,
		{
			label: t("participants"),
			value: participants.length ? <ResultCardSummary limit={2} values={participants} /> : null,
		},
	];
	const listMetadata: Array<ResultCardField> = [
		{ label: t("event-type"), value: document.type_of_event },
		...relations,
		{
			label: t("participants"),
			value: participants.length ? <ResultCardSummary limit={4} values={participants} /> : null,
		},
		{
			label: t("identifiers"),
			value: document.sameas.length ? <ResultCardSummary limit={2} values={identifiers} /> : null,
		},
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="performance"
			header={markup ? <HighlightedSnippet snippet={markup} /> : document.title}
			href={`/performance/${document.id}`}
			image="performance"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
			subheader={document.date_range}
		/>
	);
}
