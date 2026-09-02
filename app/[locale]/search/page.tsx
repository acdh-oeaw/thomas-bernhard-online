import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { NuqsProvider } from "@/app/[locale]/_components/nuqs-adapter";
import { SearchResults } from "@/app/[locale]/_components/search-results";
import { MainContent } from "@/components/ui/main-content";
import type { IntlLocale } from "@/lib/i18n/locales";

interface SearchPageProps {
	params: Promise<{
		locale: IntlLocale;
	}>;
}

export function generateMetadata(
	_props: Readonly<SearchPageProps>,
	_parent: ResolvingMetadata,
): Metadata {
	return {
		title: "Search",
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
					{t("title")}
				</h1>

				<p className="max-w-text text-pretty text-text-weak">{t("intro")}</p>

				<NuqsProvider>
					<SearchResults collectionName="work" />
				</NuqsProvider>
			</section>
		</MainContent>
	);
}
