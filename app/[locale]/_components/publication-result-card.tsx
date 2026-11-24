import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchResponseHit } from "typesense";

import { LanguageLabel } from "@/components/language-label";
import { HighlightedSnippet } from "@/components/typesense";
import type { SearchDisplayMode } from "@/config/ui";
import type { PublicationSearchDocument } from "@/lib/data";
import { publicationDateRange } from "@/lib/publication-date";
import { translationLabel } from "@/lib/translation-label";

import { SearchResultCard } from "./search-result-card";

export function PublicationResultCard(
	props: Readonly<{
		hit: SearchResponseHit<PublicationSearchDocument & { type?: "manifestation" }>;
		displayMode: SearchDisplayMode;
	}>,
): ReactNode {
	const { hit, displayMode } = props;
	const { document, highlight } = hit;
	const t = useTranslations("PublicationResultCard");
	const translations = document.expressions ?? [];
	const translationTitles = translations
		.slice(0, 4)
		.map((translation) => {
			return translationLabel(translation);
		})
		.join(", ");
	const remainingCount = translations.length - 4;
	const title = highlight.title;
	const snippet = title != null && "value" in title ? (title.value ?? title.snippet) : undefined;

	return (
		<SearchResultCard
			displayMode={displayMode}
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
				{document.publisher?.name ? <p>{document.publisher.name}</p> : null}
				{translations.length > 0 ? (
					<p>
						{t("contains", { titles: translationTitles })}
						{remainingCount > 0 ? ` ${t("more", { count: String(remainingCount) })}` : null}
					</p>
				) : null}
			</div>
		</SearchResultCard>
	);
}
