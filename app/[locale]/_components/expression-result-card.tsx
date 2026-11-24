import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { UniversalSearchDocument } from "@/lib/data";

import { ResultCardSummary } from "./result-card-summary";
import { type ResultCardField, SearchResultCard } from "./search-result-card";

type Expression = Extract<UniversalSearchDocument, { type: "expression" }>;

export function ExpressionResultCard(
	props: Readonly<{ hit: SearchResponseHit<Expression>; displayMode: SearchDisplayMode }>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("ResultCard");
	const title = highlight.title;
	const markup = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;
	const work = document.work;
	const original = work
		? `${work.title}${work.year == null ? "" : ` (${String(work.year)})`}`
		: undefined;
	const translators = (document.authors ?? []).map((person, index) => {
		return { id: `${person.name}:${String(index)}`, content: person.name };
	});
	const publications = (document.manifestations ?? []).map((publication, index) => {
		return { id: `${publication.title}:${String(index)}`, content: publication.title };
	});
	const attributes: Array<ResultCardField> = [
		{
			label: t("language"),
			value: document.language ? <LanguageLabel code={document.language} expand={true} /> : null,
			isTag: true,
		},
	];
	const cardMetadata: Array<ResultCardField> = [
		...attributes,
		{ label: t("original-work"), value: original },
		{
			label: t("translators"),
			value: translators.length ? <ResultCardSummary limit={2} values={translators} /> : null,
		},
	];
	const listMetadata: Array<ResultCardField> = [
		...attributes,
		{ label: t("original-work"), value: original },
		{
			label: t("translators"),
			value: translators.length ? <ResultCardSummary limit={4} values={translators} /> : null,
		},
		{
			label: t("publications"),
			value: publications.length ? <ResultCardSummary limit={3} values={publications} /> : null,
		},
	];

	return (
		<SearchResultCard
			displayMode={displayMode}
			entityType="expression"
			header={markup ? <HighlightedSnippet snippet={markup} /> : document.title}
			href={`/expression/${document.id}`}
			image="expression"
			metadata={displayMode === "card" ? cardMetadata : listMetadata}
			subheader={document.year}
		/>
	);
}
