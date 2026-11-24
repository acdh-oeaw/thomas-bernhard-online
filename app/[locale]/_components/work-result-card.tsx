"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { WorkWithRelations } from "@/lib/data";

import { ResultCardSummary } from "./result-card-summary";
import { type ResultCardField, SearchResultCard } from "./search-result-card";

type WorkHit = SearchResponseHit<WorkWithRelations & { type?: "work" }>;
type FieldHighlight = { snippet?: string; value?: string } | undefined;

function fieldMarkup(highlight: WorkHit["highlight"], field: string): string | undefined {
	const value = (highlight as Record<string, FieldHighlight>)[field];
	return value?.value ?? value?.snippet;
}

function relationTitle(
	highlight: WorkHit["highlight"],
	field: string,
	index: number,
	fallback: string,
): ReactNode {
	const values = highlight as Record<
		string,
		ReadonlyArray<Record<string, FieldHighlight>> | undefined
	>;
	const title = values[field]?.[index]?.title;
	const markup = title?.value ?? title?.snippet;
	return markup ? <HighlightedSnippet snippet={markup} /> : fallback;
}

export function WorkResultCard(
	props: Readonly<{ hit: WorkHit; displayMode: SearchDisplayMode }>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const identifiers = document.sameas.map((identifier) => {
		return { id: identifier, content: identifier };
	});
	const tWork = useTranslations("WorkPage");
	const title = fieldMarkup(highlight, "title");
	const category = fieldMarkup(highlight, "category");
	const translations = (document.expressions ?? []).map((expression, index) => {
		return {
			id: expression.id,
			content: (
				<>
					{relationTitle(highlight, "expressions", index, expression.title)}
					{" ("}
					<LanguageLabel code={expression.language} />
					{")"}
				</>
			),
		};
	});
	const performances = (document.performances ?? []).map((performance, index) => {
		return {
			id: performance.id,
			content: relationTitle(highlight, "performances", index, performance.title),
		};
	});
	const attributes: Array<ResultCardField> = [
		{
			label: t("category"),
			value:
				document.category || category ? (
					category ? (
						<HighlightedSnippet snippet={category} />
					) : (
						document.category
					)
				) : null,
			isTag: true,
		},
	];
	const cardMetadata: Array<ResultCardField> = [
		...attributes,
		{
			label: t("translations"),
			value: translations.length ? <ResultCardSummary limit={2} values={translations} /> : null,
		},
		{
			label: t("performances"),
			value: performances.length ? <ResultCardSummary limit={2} values={performances} /> : null,
		},
	];
	const listMetadata: Array<ResultCardField> = [
		...attributes,
		{
			label: t("translations"),
			value: translations.length ? <ResultCardSummary limit={4} values={translations} /> : null,
		},
		{
			label: t("performances"),
			value: performances.length ? <ResultCardSummary limit={4} values={performances} /> : null,
		},
		{
			label: t("identifiers"),
			value: document.sameas.length ? <ResultCardSummary limit={2} values={identifiers} /> : null,
		},
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="work"
			header={title ? <HighlightedSnippet snippet={title} /> : document.title || tWork("untitled")}
			href={`/work/${document.id}`}
			image="work"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
			subheader={document.year}
		/>
	);
}
