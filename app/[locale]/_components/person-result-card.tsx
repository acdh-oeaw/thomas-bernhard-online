import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import type { UniversalSearchDocument } from "@/lib/data";

import { SearchResultCard } from "./search-result-card";

type Person = Extract<UniversalSearchDocument, { name: string }>;
type PersonHit = SearchResponseHit<Person>;

function highlightMarkup(hit: PersonHit): string | undefined {
	const nameHighlight = hit.highlight.name;

	if (nameHighlight != null && "value" in nameHighlight) {
		return nameHighlight.value ?? nameHighlight.snippet;
	}

	return undefined;
}

export function PersonResultCard(props: Readonly<{ hit: PersonHit }>): ReactNode {
	const { hit } = props;
	const { document } = hit;
	const nameHighlight = highlightMarkup(hit);
	const t = useTranslations("SearchResults");

	return (
		<SearchResultCard
			header={
				nameHighlight != null ? <HighlightedSnippet snippet={nameHighlight} /> : document.name
			}
			href={`/person/${document.id}`}
			image="person"
			subheader={t("result-subheader-person")}
		/>
	);
}
