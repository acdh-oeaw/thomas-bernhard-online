"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { EventSearchDocument } from "@/lib/data";

import { type ResultCardField, resultCardValues, SearchResultCard } from "./search-result-card";

export function EventResultCard(
	props: Readonly<{
		hit: SearchResponseHit<EventSearchDocument>;
		displayMode: SearchDisplayMode;
	}>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const title = highlight.title;
	const markup = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;
	const participants = (document.participant_ids ?? []).flatMap((person) => {
		return person.name ? [person.name] : [];
	});
	const work = document.work;
	const original = work
		? `${work.title}${work.year == null ? "" : ` (${String(work.year)})`}`
		: undefined;
	const relations: Array<ResultCardField> = [
		{ label: t("original-work"), values: original ? [original] : [] },
		{ label: t("location"), values: document.location?.name ? [document.location.name] : [] },
	];
	const cardMetadata: Array<ResultCardField> = [
		...relations,
		{
			label: t("participants"),
			...resultCardValues(participants, 2),
		},
	];
	const listMetadata: Array<ResultCardField> = [
		{ label: t("event-type"), values: document.type_of_event ? [document.type_of_event] : [] },
		...relations,
		{
			label: t("participants"),
			...resultCardValues(participants, 4),
		},
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="event"
			header={markup ? <HighlightedSnippet snippet={markup} /> : document.title}
			href={`/event/${document.id}`}
			image="event"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
			subheader={document.date_range}
			tags={
				document.type_of_event ? [{ label: t("event-type"), value: document.type_of_event }] : []
			}
		/>
	);
}
