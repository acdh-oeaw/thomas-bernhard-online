import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense";
import type { Manifestation } from "@/lib/data";
import { publicationDateRange } from "@/lib/publication-date";

import { SearchResultCard } from "./search-result-card";

export function PublicationResultCard(
	props: Readonly<{ hit: SearchResponseHit<Manifestation> }>,
): ReactNode {
	const { hit } = props;
	const { document, highlight } = hit;
	const title = highlight.title;
	const snippet = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;

	return (
		<SearchResultCard
			entityType="manifestation"
			header={snippet != null ? <HighlightedSnippet snippet={snippet} /> : document.title}
			href={`/publication/${document.id}`}
			image="publication"
			subheader={publicationDateRange(document)}
		>
			<div className="grid gap-y-2 text-small text-text-weak">
				{document.subtitle ? <p>{document.subtitle}</p> : null}
				<p>
					<LanguageLabel code={document.language} />
				</p>
				{document.publisher?.length ? (
					<p>
						{document.publisher
							.map((publisher) => {
								return publisher.name;
							})
							.join(", ")}
					</p>
				) : null}
			</div>
		</SearchResultCard>
	);
}
