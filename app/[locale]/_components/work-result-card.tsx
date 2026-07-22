"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

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

function renderFieldValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number") {
		return String(value);
	}

	if (Array.isArray(value)) {
		const items = value.map((item) => {
			if (typeof item === "object" && item !== null) {
				const obj = item as Record<string, unknown>;
				return (obj.name as string | undefined) ?? (obj.title as string | undefined) ?? "";
			}

			return String(item);
		});

		return items.filter(Boolean).join(", ");
	}

	return "";
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
						if (!document[field]) {
							return null;
						}

						const value = renderFieldValue(document[field]);
						if (!value) {
							return null;
						}

						const highlight = findHighlight(field);

						return (
							<div key={field}>
								<dt className="text-tiny font-strong text-text-weak">{t(field)}</dt>
								<dd className="text-small text-text-weak">
									{highlight?.snippet ? (
										<HighlightedSnippet snippet={highlight.snippet} />
									) : (
										value
									)}
								</dd>
							</div>
						);
					})}
				</dl>
			</div>
		</SearchResultCard>
	);
}
