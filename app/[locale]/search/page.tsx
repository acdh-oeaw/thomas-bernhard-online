import type { Metadata, ResolvingMetadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { SearchResults } from "@/app/[locale]/_components/search-results";
import { MainContent } from "@/components/ui/main-content";
import { env } from "@/config/env.config";
import type { IntlLocale } from "@/lib/i18n/locales";

import { SearchNuqsAdapter } from "./nuqs-adapter";

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

	return (
		<MainContent className="layout-grid content-start">
			<SearchNuqsAdapter>
				<SearchResults collectionName={env.NEXT_PUBLIC_TYPESENSE_COLLECTION} />
			</SearchNuqsAdapter>
		</MainContent>
	);
}
