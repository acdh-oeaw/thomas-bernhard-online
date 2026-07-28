"use client";

import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense/highlight";
import type { tbo_workCollection } from "@/lib/typesense/collections";
import type { CollectionDocument, SearchHighlight } from "@/lib/typesense/schema";

import { SearchResultCard } from "./search-result-card";

type WorkDocument = CollectionDocument<typeof tbo_workCollection>;

interface WorkResultCardProps {
	id: string;
	document: WorkDocument;
	highlights?: Array<SearchHighlight<WorkDocument>>;
}

const displayFields = [
	"category",
	"authors",
	"performances",
	"expressions",
] as const satisfies ReadonlyArray<keyof WorkDocument>;

/** Joins the non-empty labels of a nested object list into a single comma-separated summary. */
function formatList<T>(
	items: ReadonlyArray<T> | null | undefined,
	format: (item: T) => string | null | undefined,
): string {
	if (items == null) {
		return "";
	}

	return items
		.map(format)
		.filter((label): label is string => {
			return Boolean(label);
		})
		.join(", ");
}

export function WorkResultCard(props: Readonly<WorkResultCardProps>): ReactNode {
	const { id, document, highlights } = props;
	const t = useTranslations("WorkPage");
	const href = `/work/${id}`;

	const findHighlight = (field: keyof WorkDocument): SearchHighlight<WorkDocument> | undefined => {
		return highlights?.find((highlight) => {
			return highlight.field === field;
		});
	};

	/** Typed, human-readable summary for each displayed field, derived from the nested records. */
	const fieldValues = {
		category: document.category ?? "",
		authors: formatList(document.authors, (author) => {
			return author.name;
		}),
		performances: formatList(document.performances, (performance) => {
			return performance.label;
		}),
		expressions:
			document.expressions && document.expressions.length > 0
				? document.expressions.map((expression, index) => {
						return (
							<Fragment key={expression.id ?? index}>
								{index > 0 ? ", " : null}
								{expression.title}
								{expression.language != null ? (
									<>
										{expression.title != null ? " (" : null}
										<LanguageLabel code={expression.language} />
										{expression.title != null ? ")" : null}
									</>
								) : null}
							</Fragment>
						);
					})
				: null,
	} satisfies Record<(typeof displayFields)[number], ReactNode>;

	const titleHighlight = findHighlight("title");

	return (
		<SearchResultCard href={href}>
			<div className="grid gap-y-2">
				<h2 className="font-heading text-heading-4 font-strong text-text-strong">
					{titleHighlight?.snippet ? (
						<HighlightedSnippet snippet={titleHighlight.snippet} />
					) : (
						document.title || t("untitled")
					)}
				</h2>

				<dl className="grid gap-y-2">
					{displayFields.map((field) => {
						const highlight = findHighlight(field);
						const value = fieldValues[field];
						const hasValue = value != null && value !== "";

						if (!hasValue && !highlight?.snippet) {
							return null;
						}

						return (
							<div key={field}>
								<dt className="text-tiny font-strong text-text-weak">{t(field)}</dt>
								<dd className="text-small text-text-weak">
									{highlight?.snippet ? <HighlightedSnippet snippet={highlight.snippet} /> : value}
								</dd>
							</div>
						);
					})}
				</dl>
			</div>
		</SearchResultCard>
	);
}
