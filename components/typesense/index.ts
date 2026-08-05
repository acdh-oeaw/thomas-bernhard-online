/**
 * React (React Aria) components and hooks for rendering typesense search results: facet filters,
 * pagination, ordering, result status and search-highlight rendering. They are driven by the typed
 * `@/lib/typesense` toolkit but own all of the presentational concerns.
 */

export { FacetDropdown } from "./facet-dropdown";
export { FacetList } from "./facet-list";
export { FilterDropdown } from "./filter-dropdown";
export { HighlightedSnippet } from "./highlight";
export { MultiFacetFilter } from "./multi-facet-filter";
export { OrderBy } from "./order-by";
export { Pagination } from "./pagination";
export { ResultStatus } from "./result-status";
export { type CollectionSearchState, useCollectionSearch } from "./use-collection-search";
export { type FacetValue, useFacetCounts } from "./use-facet-counts";
