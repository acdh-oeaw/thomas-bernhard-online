"use client";

import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense/highlight";
import type { tbo_workCollection } from "@/lib/typesense/collections";
import type { CollectionDocument, CollectionSearchHit } from "@/lib/typesense/schema";

import { SearchResultCard } from "./search-result-card";

type WorkDocument = CollectionDocument<typeof tbo_workCollection>;
type WorkSearchHit = CollectionSearchHit<typeof tbo_workCollection>;
type WorkHighlight = WorkSearchHit["highlight"];

const displayFields = [
	"category",
	"authors",
	"performances",
	"expressions",
] as const satisfies ReadonlyArray<keyof WorkDocument>;

/**
 * Typesense's object-form `highlight` mirrors the document. Its types are loose (nested arrays), so
 * we read snippets through small typed accessors.
 */
type StringHighlight = { snippet?: string } | undefined;
type ObjectListHighlight = ReadonlyArray<Record<string, StringHighlight>> | undefined;

/** The highlight snippet for a top-level string field, e.g. `highlight.title.snippet`. */
function fieldSnippet(highlight: WorkHighlight, field: string): string | undefined {
	return (highlight as Record<string, StringHighlight>)[field]?.snippet;
}

/**
 * The highlight snippet for a sub-field of the `index`-th entry of an `object[]` field, e.g.
 * `highlight.authors[index].name.snippet`. Typesense aligns the highlight array with the document
 * array by index.
 */
function itemSnippet(
	highlight: WorkHighlight,
	field: string,
	index: number,
	subField: string,
): string | undefined {
	return (highlight as Record<string, ObjectListHighlight>)[field]?.[index]?.[subField]?.snippet;
}

/** Renders the values of an `object[]` field as a comma-separated list, highlighting matched items. */
function renderHighlightedList(
	highlight: WorkHighlight,
	field: string,
	subField: string,
	values: ReadonlyArray<string | null | undefined>,
): ReactNode {
	const entries = values
		.map((value, index) => {
			return { value, index, snippet: itemSnippet(highlight, field, index, subField) };
		})
		.filter((entry) => {
			return entry.snippet != null || (entry.value != null && entry.value !== "");
		});

	if (entries.length === 0) {
		return null;
	}

	return entries.map((entry, position) => {
		return (
			<Fragment key={entry.index}>
				{position > 0 ? ", " : null}
				{entry.snippet != null ? <HighlightedSnippet snippet={entry.snippet} /> : entry.value}
			</Fragment>
		);
	});
}

/** Renders the expressions as a comma-separated list of highlighted titles with their language. */
function renderExpressions(
	highlight: WorkHighlight,
	expressions: WorkDocument["expressions"],
): ReactNode {
	if (expressions == null || expressions.length === 0) {
		return null;
	}

	const entries = expressions
		.map((expression, index) => {
			return { expression, index, snippet: itemSnippet(highlight, "expressions", index, "title") };
		})
		.filter((entry) => {
			return (
				entry.snippet != null || entry.expression.title != null || entry.expression.language != null
			);
		});

	if (entries.length === 0) {
		return null;
	}

	return entries.map((entry, position) => {
		const { expression, index, snippet } = entry;
		const hasTitle = snippet != null || expression.title != null;

		return (
			<Fragment key={expression.id ?? index}>
				{position > 0 ? ", " : null}
				{snippet != null ? <HighlightedSnippet snippet={snippet} /> : expression.title}
				{expression.language != null ? (
					<>
						{hasTitle ? " (" : null}
						<LanguageLabel code={expression.language} />
						{hasTitle ? ")" : null}
					</>
				) : null}
			</Fragment>
		);
	});
}

interface WorkResultCardProps {
	hit: WorkSearchHit;
}

export function WorkResultCard(props: Readonly<WorkResultCardProps>): ReactNode {
	const { hit } = props;
	const { document, highlight } = hit;
	const t = useTranslations("WorkPage");
	const href = `/work/${document.id}`;

	const titleSnippet = fieldSnippet(highlight, "title");
	const categorySnippet = fieldSnippet(highlight, "category");

	/** Rendered (highlight-aware) content for each displayed field. */
	const fieldValues = {
		category:
			categorySnippet != null ? (
				<HighlightedSnippet snippet={categorySnippet} />
			) : (
				(document.category ?? "")
			),
		authors: renderHighlightedList(
			highlight,
			"authors",
			"name",
			(document.authors ?? []).map((author) => {
				return author.name;
			}),
		),
		performances: renderHighlightedList(
			highlight,
			"performances",
			"label",
			(document.performances ?? []).map((performance) => {
				return performance.label;
			}),
		),
		expressions: renderExpressions(highlight, document.expressions),
	} satisfies Record<(typeof displayFields)[number], ReactNode>;

	return (
		<SearchResultCard href={href}>
			<div className="grid gap-y-2">
				<h2 className="font-heading text-heading-4 font-strong text-text-strong">
					{titleSnippet != null ? (
						<HighlightedSnippet snippet={titleSnippet} />
					) : (
						document.title || t("untitled")
					)}
				</h2>

				<dl className="grid gap-y-2">
					{displayFields.map((field) => {
						const value = fieldValues[field];

						if (value == null || value === "") {
							return null;
						}

						return (
							<div key={field}>
								<dt className="text-tiny font-strong text-text-weak">{t(field)}</dt>
								<dd className="text-small text-text-weak">{value}</dd>
							</div>
						);
					})}
				</dl>
			</div>
		</SearchResultCard>
	);
}
