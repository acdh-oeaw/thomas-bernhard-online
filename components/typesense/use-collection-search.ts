"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentSchema, SearchOptions, SearchResponse, SearchResponseHit } from "typesense";

import { abortableEffect } from "@/lib/abortable-effect";
import type { collections } from "@/lib/typesense/collections";
import type { DocumentFromSchema } from "@/lib/typesense/schema";
import {
	type CollectionName,
	type CollectionSearchParams,
	searchCollection,
} from "@/lib/typesense/search";

/** A search hit for the named collection. */
type CollectionHit<D extends DocumentSchema> = SearchResponseHit<D>;

type BaseDocument<K extends CollectionName> = DocumentFromSchema<
	(typeof collections)[K]["collection"]
>;

/** A collection-specific search function, including a data-layer function that adds joins. */
type CollectionSearchFunction<
	K extends CollectionName,
	D extends BaseDocument<K> & DocumentSchema,
> = (params: CollectionSearchParams<K>, options?: SearchOptions) => Promise<SearchResponse<D>>;

/**
 * Pagination + hits, carried by every state so stale results can stay visible (dimmed) while a
 * refetch is in flight rather than blanking on every keystroke.
 */
interface CollectionSearchPage<D extends DocumentSchema> {
	readonly hits: ReadonlyArray<CollectionHit<D>>;
	readonly found: number;
	readonly page: number;
	readonly perPage: number;
}

type CollectionSearchStatus<D extends DocumentSchema> = CollectionSearchPage<D> &
	(
		| { readonly status: "error"; readonly error: Error }
		| { readonly status: "loading"; readonly error: null }
		| { readonly status: "success"; readonly error: null }
	);

/**
 * The result of {@link useCollectionSearch}: a discriminated union over `status` so consumers can
 * render distinct loading / error / results branches. An *empty* result is `status: "success"` with
 * an empty `hits` array — distinct from `status: "error"`, which carries the thrown `Error`. `retry`
 * re-runs the most recent search, e.g. from an error state's "try again" button.
 */
export type CollectionSearchState<
	K extends CollectionName,
	D extends BaseDocument<K> & DocumentSchema = BaseDocument<K>,
> = CollectionSearchStatus<D> & {
	readonly retry: () => void;
};

const emptyPage = { hits: [], found: 0, page: 1, perPage: 0 } as const;

/**
 * Runs a typesense search for the current `params` and exposes it as a discriminated-union state
 * machine (loading / error / success). The search re-runs whenever the *content* of `params`
 * changes and aborts any superseded request (so a slow earlier response can't overwrite newer
 * state). Shared by the search and catalog views; see `CollectionSearchState`.
 */
export function useCollectionSearch<
	K extends CollectionName,
	D extends BaseDocument<K> & DocumentSchema = BaseDocument<K>,
>(
	collectionName: K,
	params: CollectionSearchParams<K>,
	search?: CollectionSearchFunction<K, D>,
): CollectionSearchState<K, D> {
	const [snapshot, setSnapshot] = useState<CollectionSearchStatus<D>>(() => {
		return { status: "loading", error: null, ...emptyPage };
	});
	const [reloadKey, setReloadKey] = useState(0);

	// Re-run on the params' *content*, not their (per-render) identity. The live params are read
	// through a ref so they don't need to be an effect dependency.
	const paramsKey = JSON.stringify(params);
	const paramsRef = useRef(params);
	const searchRef = useRef(search);

	// Keep the ref current. Defined before the search effect, so on a render where `paramsKey`
	// changed this runs first and the search effect below reads fresh params.
	useEffect(() => {
		paramsRef.current = params;
		searchRef.current = search;
	});

	useEffect(() => {
		return abortableEffect(async (signal) => {
			// Enter loading but keep any existing hits so the UI can dim them rather than blank out.
			setSnapshot((previous) => {
				return {
					status: "loading",
					error: null,
					hits: previous.hits,
					found: previous.found,
					page: previous.page,
					perPage: previous.perPage,
				};
			});

			try {
				const results: SearchResponse<D> = await (searchRef.current == null
					? searchCollection<K, D>(collectionName, paramsRef.current, { abortSignal: signal })
					: searchRef.current(paramsRef.current, { abortSignal: signal }));

				if (signal.aborted) return;

				setSnapshot({
					status: "success",
					error: null,
					hits: results.hits ?? [],
					found: results.found,
					page: results.page,
					perPage: results.request_params.per_page ?? 0,
				});
			} catch (error) {
				// A superseded request rejects with an abort error; ignore it.
				if (signal.aborted) return;
				console.error("Failed to fetch search results:", error);
				setSnapshot({
					status: "error",
					error: error instanceof Error ? error : new Error(String(error)),
					...emptyPage,
				});
			}
		});
	}, [collectionName, paramsKey, reloadKey]);

	const retry = useCallback(() => {
		setReloadKey((key) => {
			return key + 1;
		});
	}, []);

	return { ...snapshot, retry };
}
