import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { NuqsProvider } from "#/app/[locale]/_components/nuqs-adapter.tsx";
import { UnifiedSearch } from "#/app/[locale]/_components/unified-search.tsx";
import { MainContent } from "#/components/ui/main-content.tsx";
import { getAlternates } from "#/lib/i18n/alternates.ts";
import type { IntlLocale } from "#/lib/i18n/locales.ts";

interface SearchPageProps {
	params: Promise<{
		locale: IntlLocale;
	}>;
}

export async function generateMetadata(
	props: Readonly<SearchPageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { locale } = await props.params;

	return {
		title: "Search",
		alternates: getAlternates(locale, "/search"),
	};
}

export default async function SearchPage(props: Readonly<SearchPageProps>): Promise<ReactNode> {
	const { params } = props;
	const { locale } = await params;

	setRequestLocale(locale);

	const t = await getTranslations("SearchResults");

	return (
		<MainContent className="layout-grid content-start">
			<section className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<h1 className="font-heading text-heading-2 font-strong text-balance text-text-strong">
					{t("universal-search-title")}
				</h1>

				<p className="max-w-text text-pretty text-text-weak">{t("universal-search-intro")}</p>

				<NuqsProvider>
					<UnifiedSearch />
				</NuqsProvider>
			</section>
		</MainContent>
	);
}
