"use client";

import { useEffect, useMemo, useState } from "react";

import { abortableEffect } from "@/lib/abortable-effect";
import { collections } from "@/lib/typesense/collections";
import { type CollectionName, searchCollectionUnchecked } from "@/lib/typesense/search";

export interface FacetValue {
	value: string;
	count: number;
}

/** Decade buckets for the work year facet; range ends are exclusive in Typesense. */
export const YEAR_FACET_QUERY =
	"year(1960s:[1960,1970], 1970s:[1970,1980], 1980s:[1980,1990], 1990s:[1990,2000], 2000s:[2000,2010], 2010-:[2010,])";

const yearFacetFilters: Record<string, string> = {
	"1960s": "year:[1960..1969]",
	"1970s": "year:[1970..1979]",
	"1980s": "year:[1980..1989]",
	"1990s": "year:[1990..1999]",
	"2000s": "year:[2000..2009]",
	"2010-": "year:>=2010",
};

export function yearFacetFilter(value: string): string {
	return yearFacetFilters[value] ?? `year:=${value}`;
}

interface UseFacetCountsParams {
	collectionName: CollectionName;
	searchQuery: string;
	facetFields: ReadonlyArray<string | { name: string; query: string }>;
	selectedValues: Record<string, Set<string>>;
	/** Optional typesense `filter_by` expression applied when fetching the counts. */
	filterBy?: string;
}

function areFacetDataEqual(
	previous: Record<string, Array<FacetValue>>,
	next: Record<string, Array<FacetValue>>,
	fieldNames: ReadonlyArray<string>,
): boolean {
	if (Object.keys(previous).length !== fieldNames.length) {
		return false;
	}

	return fieldNames.every((fieldName) => {
		const previousCounts = previous[fieldName] ?? [];
		const nextCounts = next[fieldName] ?? [];

		return (
			previousCounts.length === nextCounts.length &&
			previousCounts.every((item, index) => {
				return item.value === nextCounts[index]!.value && item.count === nextCounts[index]!.count;
			})
		);
	});
}

/**
 * Fetches typesense facet counts for several fields at once for the current search query. Selected
 * values that the query returns no results for (and are therefore absent from the counts) are
 * appended with a count of 0 so they stay visible and deselectable. Shared by the facet filter UIs.
 *
 * The fetched counts keep their previous reference when unchanged, so downstream memos (and the
 * components' selection lists) don't churn on identical refetches.
 */
export function useFacetCounts(params: Readonly<UseFacetCountsParams>): {
	displayData: Record<string, Array<FacetValue>>;
	isFetching: boolean;
} {
	const { collectionName, searchQuery, facetFields, selectedValues, filterBy } = params;

	const [facetData, setFacetData] = useState<Record<string, Array<FacetValue>>>({});
	const [isFetching, setIsFetching] = useState(false);

	const facetFieldConfigs = useMemo(() => {
		return facetFields.map((field) => {
			return typeof field === "string" ? { name: field, query: field } : field;
		});
	}, [facetFields]);

	// Primitive key so the fetch only re-runs when the set of faceted fields actually changes,
	// regardless of the `facetFields` array identity.
	const facetFieldsKey = facetFieldConfigs
		.map((field) => {
			return `${field.name}=${field.query}`;
		})
		.join(",");

	useEffect(() => {
		return abortableEffect(async (signal) => {
			if (facetFieldConfigs.length === 0) {
				return;
			}

			setIsFetching(true);
			try {
				// `facet_by` is assembled from the runtime `facetFields`, so the field-name params can't be
				// statically checked here — use the unchecked search variant.
				const searchResults = await searchCollectionUnchecked(
					collectionName,
					{
						q: searchQuery || "*",
						query_by: collections[collectionName].queryableFieldNames.join(","),
						facet_by: facetFieldConfigs
							.map((field) => {
								return field.query;
							})
							.join(","),
						// Facet-only search: no document hits needed.
						per_page: 0,
						...(filterBy != null ? { filter_by: filterBy } : {}),
					},
					{ abortSignal: signal },
				);

				if (signal.aborted) return;

				const next: Record<string, Array<FacetValue>> = {};
				for (const field of facetFieldConfigs) {
					next[field.name] =
						searchResults.facet_counts
							?.find((facetCount) => {
								return (
									facetCount.field_name === field.name || facetCount.field_name === field.query
								);
							})
							?.counts.map((count) => {
								return { value: count.value, count: count.count };
							}) ?? [];
				}

				setFacetData((previous) => {
					return areFacetDataEqual(
						previous,
						next,
						facetFieldConfigs.map((field) => {
							return field.name;
						}),
					)
						? previous
						: next;
				});
			} catch (error) {
				// A superseded request rejects with an abort error; ignore it.
				if (signal.aborted) return;
				console.error("Failed to fetch facet values:", error);
				setFacetData({});
			} finally {
				if (!signal.aborted) {
					setIsFetching(false);
				}
			}
		});
	}, [collectionName, searchQuery, facetFieldsKey, facetFieldConfigs, filterBy]);

	const displayData = useMemo(() => {
		const result: Record<string, Array<FacetValue>> = {};

		for (const field of facetFieldConfigs) {
			const counts = facetData[field.name] ?? [];
			const selected = selectedValues[field.name];

			const missing =
				selected != null
					? Array.from(selected)
							.filter((value) => {
								return !counts.some((count) => {
									return count.value === value;
								});
							})
							.map((value) => {
								return { value, count: 0 };
							})
					: [];

			result[field.name] = missing.length > 0 ? [...counts, ...missing] : counts;
		}

		return result;
	}, [facetFieldConfigs, facetData, selectedValues]);

	return { displayData, isFetching };
}
