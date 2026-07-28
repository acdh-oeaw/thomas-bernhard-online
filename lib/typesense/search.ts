import type { SearchParams, SearchResponse } from "typesense";

import { defaultLimit, maxFacetValues } from "@/config/search.config";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";

/**
 * Runs a typesense search with the shared `search.config` defaults applied (`per_page`,
 * `max_facet_values`), so every caller observes the config without repeating it. Values in `params`
 * override the defaults (e.g. a facet-only search can pass `per_page: 0`).
 */
export function searchCollection<T extends Record<string, unknown> = Record<string, unknown>>(
	collectionName: string,
	params: SearchParams<T>,
): Promise<SearchResponse<T>> {
	return createTypesenseClient()
		.collections<T>(collectionName)
		.documents()
		.search({
			per_page: defaultLimit,
			max_facet_values: maxFacetValues,
			...params,
		});
}
