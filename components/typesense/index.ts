/**
 * React (React Aria) components and hooks for rendering typesense search results: facet filters,
 * pagination, ordering, result status and search-highlight rendering. They are driven by the typed
 * `#/lib/typesense` toolkit but own all of the presentational concerns.
 */

export { FacetDropdown } from "./facet-dropdown.tsx";
export { FacetList } from "./facet-list.tsx";
export { FilterDropdown } from "./filter-dropdown.tsx";
export { HighlightedSnippet } from "./highlight.tsx";
export { MultiFacetFilter } from "./multi-facet-filter.tsx";
export { OrderBy } from "./order-by.tsx";
export { Pagination } from "./pagination.tsx";
export { ResultStatus } from "./result-status.tsx";
export { type CollectionSearchState, useCollectionSearch } from "./use-collection-search.ts";
export {
	type FacetValue,
	useFacetCounts,
	YEAR_FACET_QUERY,
	yearFacetFilter,
} from "./use-facet-counts.ts";
