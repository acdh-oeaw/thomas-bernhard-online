import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { HighlightedSnippet } from "@/components/typesense";
import type { UniversalSearchDocument } from "@/lib/data";

import { SearchResultCard } from "./search-result-card";

type Group = Extract<UniversalSearchDocument, { type: "group" }>;
type GroupHit = SearchResponseHit<Group>;

function highlightMarkup(hit: GroupHit): string | undefined {
	const nameHighlight = hit.highlight.name;

	if (nameHighlight != null && "value" in nameHighlight) {
		return nameHighlight.value ?? nameHighlight.snippet;
	}

	return undefined;
}

export function GroupResultCard(props: Readonly<{ hit: GroupHit }>): ReactNode {
	const { hit } = props;
	const { document } = hit;
	const nameHighlight = highlightMarkup(hit);

	return (
		<SearchResultCard
			entityType="group"
			header={
				nameHighlight != null ? <HighlightedSnippet snippet={nameHighlight} /> : document.name
			}
			href={`/group/${document.id}`}
			image="group"
		/>
	);
}
