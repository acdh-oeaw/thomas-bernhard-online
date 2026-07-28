"use client";

import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense/highlight";
import type { collections } from "@/lib/typesense/collections";
import type { CollectionDocument, CollectionSearchHit } from "@/lib/typesense/schema";

import { SearchResultCard } from "./search-result-card";

type WorkDocument = CollectionDocument<typeof collections.tbo_work.collection>;
type WorkSearchHit = CollectionSearchHit<typeof collections.tbo_work.collection>;
type WorkHighlight = WorkSearchHit["highlight"];

const displayFields = [
	"category",
	"authors",
	"performances",
	"expressions",
] as const satisfies ReadonlyArray<keyof WorkDocument>;

/**
 * Typesense's object-form `highlight` mirrors the document. Its types are loose (nested arrays), so
 * we read the highlighted markup through small typed accessors. The full `value` (the whole field
 * with `<mark>` tags) is preferred; the truncated `snippet` is only a fallback.
 */
type FieldHighlight = { snippet?: string; value?: string } | undefined;
type ObjectListHighlight = ReadonlyArray<Record<string, FieldHighlight>> | undefined;

function highlightMarkup(highlight: FieldHighlight): string | undefined {
	return highlight?.value ?? highlight?.snippet;
}

/** The highlighted markup for a top-level string field, e.g. `highlight.title`. */
function fieldHighlight(highlight: WorkHighlight, field: string): string | undefined {
	return highlightMarkup((highlight as Record<string, FieldHighlight>)[field]);
}

/**
 * The highlighted markup for a sub-field of the `index`-th entry of an `object[]` field, e.g.
 * `highlight.authors[index].name`. Typesense aligns the highlight array with the document array by
 * index.
 */
function itemHighlight(
	highlight: WorkHighlight,
	field: string,
	index: number,
	subField: string,
): string | undefined {
	return highlightMarkup(
		(highlight as Record<string, ObjectListHighlight>)[field]?.[index]?.[subField],
	);
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
			return { value, index, markup: itemHighlight(highlight, field, index, subField) };
		})
		.filter((entry) => {
			return entry.markup != null || (entry.value != null && entry.value !== "");
		});

	if (entries.length === 0) {
		return null;
	}

	return entries.map((entry, position) => {
		return (
			<Fragment key={entry.index}>
				{position > 0 ? ", " : null}
				{entry.markup != null ? <HighlightedSnippet snippet={entry.markup} /> : entry.value}
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
			return { expression, index, markup: itemHighlight(highlight, "expressions", index, "title") };
		})
		.filter((entry) => {
			return (
				entry.markup != null || entry.expression.title != null || entry.expression.language != null
			);
		});

	if (entries.length === 0) {
		return null;
	}

	return entries.map((entry, position) => {
		const { expression, index, markup } = entry;
		const hasTitle = markup != null || expression.title != null;

		return (
			<Fragment key={expression.id ?? index}>
				{position > 0 ? ", " : null}
				{markup != null ? <HighlightedSnippet snippet={markup} /> : expression.title}
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

	const titleMarkup = fieldHighlight(highlight, "title");
	const categoryMarkup = fieldHighlight(highlight, "category");

	/** Rendered (highlight-aware) content for each displayed field. */
	const fieldValues = {
		category:
			categoryMarkup != null ? (
				<HighlightedSnippet snippet={categoryMarkup} />
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
					{titleMarkup != null ? (
						<HighlightedSnippet snippet={titleMarkup} />
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
