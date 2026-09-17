"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SearchOptions } from "typesense";

import { type SearchFilters, SearchResults } from "@/app/[locale]/_components/search-results";
import type { CollectionSearchResult } from "@/components/typesense/use-collection-search";
import { getWorksWithRelations, type WorkWithRelations } from "@/lib/data";
import { collections } from "@/lib/typesense/collections";
import type { CollectionSearchParams } from "@/lib/typesense/search";

import { WorkResultCard } from "./work-result-card";

export function WorkSearch(): ReactNode {
	const t = useTranslations("SearchResults");
	const search = async (
		params: CollectionSearchParams<"work">,
		options: SearchOptions | undefined,
		_filters: SearchFilters,
	): Promise<CollectionSearchResult<WorkWithRelations>> => {
		const response = await getWorksWithRelations(params, options);

		return {
			hits: response.hits ?? [],
			found: response.found,
			page: response.page,
			request_params: response.request_params,
		};
	};

	return (
		<SearchResults
			collectionName="work"
			queryBy={collections.work.queryableFieldNames}
			renderHit={(hit) => {
				return <WorkResultCard key={hit.document.id} hit={hit} />;
			}}
			resultLabel={t("result-collection-work")}
			search={search}
		/>
	);
}
