import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import type { UniversalSearchDocument } from "@/lib/data";

import { SearchResultCard } from "./search-result-card";

type Person = Extract<UniversalSearchDocument, { type: "person" }>;
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

	return (
		<SearchResultCard
			entityType="person"
			header={
				nameHighlight != null ? <HighlightedSnippet snippet={nameHighlight} /> : document.name
			}
			href={`/person/${document.id}`}
			image="person"
		/>
	);
}
