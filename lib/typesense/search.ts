import type { SearchParams, SearchResponse } from "typesense";

import { defaultSearchParams } from "@/config/typesense.config";
import type { collections } from "@/lib/typesense/collections";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import type { CollectionDocument } from "@/lib/typesense/schema";

export type CollectionName = keyof typeof collections;

type CollectionDoc<K extends CollectionName> = CollectionDocument<
	(typeof collections)[K]["collection"]
>;

/**
 * Runs a typesense search against one of the generated `collections`, applying the shared
 * `defaultSearchParams`. The collection's document type is inferred from `collectionName`, so
 * `params` and the returned hits are fully typed. Values in `params` override the defaults (e.g. a
 * facet-only search can pass `per_page: 0`).
 */
export function searchCollection<K extends CollectionName>(
	collectionName: K,
	params: SearchParams<CollectionDoc<K>>,
): Promise<SearchResponse<CollectionDoc<K>>> {
	return createTypesenseClient()
		.collections<CollectionDoc<K>>(collectionName)
		.documents()
		.search({
			...defaultSearchParams,
			...params,
		});
}
