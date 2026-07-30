import type { ConfigurationOptions, DocumentSchema, SearchParams } from "typesense";

/**
 * Static typesense client options. Env-dependent options (`apiKey`, `nodes`) are supplied by
 * `createTypesenseClient`.
 */
export const clientConfig = {
	connectionTimeoutSeconds: 3,
	cacheSearchResultsForSeconds: 60 * 60,
} satisfies Partial<ConfigurationOptions>;

/**
 * Default `SearchParams` applied to every typesense `search()` call (via `searchCollection`).
 * Individual searches may override any of these.
 */
export const defaultSearchParams = {
	per_page: 25,

	// query match ordering
	prioritize_token_position: true,
	text_match_type: "sum_score",

	/**
	 * Intentionally high value to reduce the risk of selected facet values not being
	 * included in the api response.
	 *
	 * @see https://github.com/typesense/typesense/issues/2131
	 */
	max_facet_values: 250,
} satisfies SearchParams<DocumentSchema>;

export const defaultVisibleFacetValues = 10;

export const maxVisibleFacetValues = 25;
