import type {
	MultiSearchRequestsWithUnionSchema,
	MultiSearchUnionParameters,
	SearchOptions,
	SearchParams,
	SearchResponse,
	UnionSearchResponse,
} from "typesense";

import { defaultSearchParams } from "@/config/typesense.config";
import type { collections } from "@/lib/typesense/collections";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import type {
	CollectionDocumentWithJoins,
	CollectionFacetableFieldName,
	CollectionQueryableFieldName,
	CollectionSortableFieldName,
	DocumentFromSchema,
} from "@/lib/typesense/schema";

export type CollectionName = keyof typeof collections;

type CollectionSchema<K extends CollectionName> = (typeof collections)[K]["collection"];

type DocumentForName<K extends CollectionName> = DocumentFromSchema<CollectionSchema<K>>;

/**
 * A collection's document with its optional joined documents (see `CollectionDocumentWithJoins`).
 * This is the *response* document type — `params` stay typed against the base `DocumentForName`, since
 * joined fields are not part of the `filter_by` / `sort_by` / `query_by` grammar.
 */
type CollectionDocWithJoins<K extends CollectionName> = CollectionDocumentWithJoins<
	typeof collections,
	K
>;

type QueryableField<K extends CollectionName> = CollectionQueryableFieldName<CollectionSchema<K>>;
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
	query_by?: OneOrMany<QueryableField<K>>;
	sort_by?: OneOrMany<SortClause<K>>;
	facet_by?: OneOrMany<FacetableField<K>>;
	group_by?: OneOrMany<FacetableField<K>>;
	highlight_fields?: OneOrMany<QueryableField<K>>;
	highlight_full_fields?: OneOrMany<QueryableField<K>>;
}

/**
 * `SearchParams` specialised to a known collection: identical to typesense's `SearchParams`, except
 * the field-name params are restricted to fields that exist on collection `K` (see
 * `FieldConstrainedParams`). This is what `searchCollection` accepts; for a call whose field lists
 * are only known at runtime, use `searchCollectionUnchecked` with the raw `SearchParams`.
 */
export type CollectionSearchParams<K extends CollectionName> = FieldConstrainedParams<K> &
	Omit<SearchParams<DocumentForName<K>>, keyof FieldConstrainedParams<K>>;

function runSearch<K extends CollectionName>(
	collectionName: K,
	params: SearchParams<DocumentForName<K>>,
	options?: SearchOptions,
): Promise<SearchResponse<CollectionDocWithJoins<K>>> {
	return createTypesenseClient()
		.collections<CollectionDocWithJoins<K>>(collectionName)
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
): Promise<SearchResponse<CollectionDocWithJoins<K>>> {
	// The narrowing lives in `CollectionSearchParams`; typesense itself only types these params as
	// `string | string[]`, so widening back to the raw `SearchParams` here is safe.
	return runSearch(collectionName, params as SearchParams<DocumentForName<K>>, options);
}

/**
 * Like `searchCollection`, but accepts the raw, unrestricted typesense `SearchParams`. Use this only
 * when the field-name params genuinely cannot be typed statically (e.g. sort or facet fields
 * assembled from user or url state); the response document type is still inferred from
 * `collectionName`.
 */
export function searchCollectionUnchecked<K extends CollectionName>(
	collectionName: K,
	params: SearchParams<DocumentForName<K>>,
	options?: SearchOptions,
): Promise<SearchResponse<CollectionDocWithJoins<K>>> {
	return runSearch(collectionName, params, options);
}

/** Union of the document types of the collections named in a `searchCollections` tuple. */
type UnionDoc<C extends ReadonlyArray<CollectionName>> = DocumentForName<C[number]>;

/**
 * Runs a typesense federated (`union: true`) multi-search across several — possibly different —
 * collections and merges the matches into a single ranked result list. Each entry pairs a
 * `collection` with that collection's typed `CollectionSearchParams` (field-name params are
 * constrained per collection), the shared `defaultSearchParams` are applied to each, and
 * `commonParams` apply across the whole union.
 *
 * Because the searched collections may differ, the response is a `UnionSearchResponse` whose hits
 * carry the **union** of the collections' document types — so `hit.document` must be narrowed (e.g.
 * on a discriminating field) before its collection-specific fields can be read.
 *
 * @see https://typesense.org/docs/latest/api/federated-multi-search.html#union-search
 */
export function searchCollections<const C extends ReadonlyArray<CollectionName>>(
	searches: {
		readonly [I in keyof C]: { readonly collection: C[I] } & CollectionSearchParams<C[I]>;
	},
	commonParams?: MultiSearchUnionParameters<UnionDoc<C>, string>,
	options?: SearchOptions,
): Promise<UnionSearchResponse<UnionDoc<C>>> {
	// The per-collection narrowing lives in the `searches` type; typesense types each search as the
	// looser `SearchParams<UnionDoc>`, so widening back to its request shape here is safe.
	const searchRequests = searches.map((search) => {
		return { ...defaultSearchParams, ...search };
	}) as MultiSearchRequestsWithUnionSchema<UnionDoc<C>, string>["searches"];

	return createTypesenseClient().multiSearch.perform<Array<UnionDoc<C>>>(
		{ union: true, searches: searchRequests },
		commonParams,
		options,
	);
}
