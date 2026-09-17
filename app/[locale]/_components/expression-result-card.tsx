import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense";
import type { UniversalSearchDocument } from "@/lib/data";

import { SearchResultCard } from "./search-result-card";

type Expression = Extract<UniversalSearchDocument, { type: "expression" }>;
type ExpressionHit = SearchResponseHit<Expression>;

function highlightMarkup(hit: ExpressionHit): string | undefined {
	const titleHighlight = hit.highlight.title;

	if (titleHighlight != null && "value" in titleHighlight) {
		return titleHighlight.value ?? titleHighlight.snippet;
	}

	return undefined;
}

export function ExpressionResultCard(props: Readonly<{ hit: ExpressionHit }>): ReactNode {
	const { hit } = props;
	const { document } = hit;
	const titleHighlight = highlightMarkup(hit);

	return (
		<SearchResultCard
			header={
				titleHighlight != null ? <HighlightedSnippet snippet={titleHighlight} /> : document.title
			}
			href={`/expression/${document.id}`}
			image="expression"
			subheader={document.year}
		>
			<div>
				<p className="font-heading text-heading-4 text-text-weak">
					<LanguageLabel code={document.language} />
				</p>
				{document.work?.title != null ? (
					<p className="text-small text-text-weak">
						{"translation of "} {document.work.title} ({document.work.year})
					</p>
				) : null}
			</div>
		</SearchResultCard>
	);
}
