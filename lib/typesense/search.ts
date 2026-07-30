import type { SearchOptions, SearchParams, SearchResponse } from "typesense";

import { defaultSearchParams } from "@/config/typesense.config";
import type { collections } from "@/lib/typesense/collections";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import type {
	CollectionDocument,
	CollectionFacetableFieldName,
	CollectionSearchableFieldName,
	CollectionSortableFieldName,
} from "@/lib/typesense/schema";

export type CollectionName = keyof typeof collections;

type CollectionSchema<K extends CollectionName> = (typeof collections)[K]["collection"];

type CollectionDoc<K extends CollectionName> = CollectionDocument<CollectionSchema<K>>;

type SearchableField<K extends CollectionName> = CollectionSearchableFieldName<CollectionSchema<K>>;
type SortableField<K extends CollectionName> = CollectionSortableFieldName<CollectionSchema<K>>;
type FacetableField<K extends CollectionName> = CollectionFacetableFieldName<CollectionSchema<K>>;

/** A single value or an array of them — typesense accepts either for its multi-field params. */
type OneOrMany<T> = T | ReadonlyArray<T>;

/**
 * A typesense `sort_by` clause: a sortable field with a direction, plus the special relevance token.
 * Exotic clauses (`_eval(...)`, geo `location(...)`) are intentionally not modelled — widen this
 * union if you need them, or fall back to `searchCollectionUnchecked`.
 */
type SortClause<K extends CollectionName> =
	| `_text_match:asc`
	| `_text_match:desc`
	| `${SortableField<K>}:asc`
	| `${SortableField<K>}:desc`;

/**
 * The `SearchParams` keys whose values are field names, narrowed to the fields that actually exist
 * on collection `K`. These are the params typesense hard-errors on when handed an unknown field, so
 * constraining them turns a class of runtime "Could not find a field" failures into compile-time
 * errors. Forgiving params are deliberately left untouched: `include_fields` / `exclude_fields`
 * ignore unknown fields, and `filter_by` is a whole expression grammar not worth modelling here.
 */
interface FieldConstrainedParams<K extends CollectionName> {
	query_by?: OneOrMany<SearchableField<K>>;
	sort_by?: OneOrMany<SortClause<K>>;
	facet_by?: OneOrMany<FacetableField<K>>;
	group_by?: OneOrMany<FacetableField<K>>;
	highlight_fields?: OneOrMany<SearchableField<K>>;
	highlight_full_fields?: OneOrMany<SearchableField<K>>;
}

/**
 * `SearchParams` specialised to a known collection: identical to typesense's `SearchParams`, except
 * the field-name params are restricted to fields that exist on collection `K` (see
 * `FieldConstrainedParams`). This is what `searchCollection` accepts; for a call whose field lists
 * are only known at runtime, use `searchCollectionUnchecked` with the raw `SearchParams`.
 */
export type CollectionSearchParams<K extends CollectionName> = FieldConstrainedParams<K> &
	Omit<SearchParams<CollectionDoc<K>>, keyof FieldConstrainedParams<K>>;

function runSearch<K extends CollectionName>(
	collectionName: K,
	params: SearchParams<CollectionDoc<K>>,
	options?: SearchOptions,
): Promise<SearchResponse<CollectionDoc<K>>> {
	return createTypesenseClient()
		.collections<CollectionDoc<K>>(collectionName)
		.documents()
		.search(
			{
				...defaultSearchParams,
				...params,
			},
			options,
		);
}

/**
 * Runs a typesense search against one of the generated `collections`, applying the shared
 * `defaultSearchParams`. The collection's document type is inferred from `collectionName`, so
 * `params` and the returned hits are fully typed, and the field-name params (`query_by`, `sort_by`,
 * `facet_by`, `highlight_full_fields`, …) only accept fields that exist on the collection. Values in
 * `params` override the defaults (e.g. a facet-only search can pass `per_page: 0`). Pass
 * `options.abortSignal` to cancel an in-flight request.
 *
 * When a field-name param can only be assembled at runtime (e.g. a `sort_by` or `facet_by` built
 * from url state) and cannot satisfy `CollectionSearchParams`, reach for `searchCollectionUnchecked`
 * instead of casting.
 */
export function searchCollection<K extends CollectionName>(
	collectionName: K,
	params: CollectionSearchParams<K>,
	options?: SearchOptions,
): Promise<SearchResponse<CollectionDoc<K>>> {
	// The narrowing lives in `CollectionSearchParams`; typesense itself only types these params as
	// `string | string[]`, so widening back to the raw `SearchParams` here is safe.
	return runSearch(collectionName, params as SearchParams<CollectionDoc<K>>, options);
}

/**
 * Like `searchCollection`, but accepts the raw, unrestricted typesense `SearchParams`. Use this only
 * when the field-name params genuinely cannot be typed statically (e.g. sort or facet fields
 * assembled from user or url state); the response document type is still inferred from
 * `collectionName`.
 */
export function searchCollectionUnchecked<K extends CollectionName>(
	collectionName: K,
	params: SearchParams<CollectionDoc<K>>,
	options?: SearchOptions,
): Promise<SearchResponse<CollectionDoc<K>>> {
	return runSearch(collectionName, params, options);
}
