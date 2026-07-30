import type { Metadata, ResolvingMetadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { SearchResults } from "@/app/[locale]/_components/search-results";
import { MainContent } from "@/components/ui/main-content";
import { env } from "@/config/env.config";
import type { IntlLocale } from "@/lib/i18n/locales";
import type { CollectionName } from "@/lib/typesense/search";

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
				{/* The collection is generated from this same env var, so its name is a known key. */}
				<SearchResults collectionName={env.NEXT_PUBLIC_TYPESENSE_COLLECTION as CollectionName} />
			</SearchNuqsAdapter>
		</MainContent>
	);
}
