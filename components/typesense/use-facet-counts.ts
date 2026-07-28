"use client";

import { useEffect, useMemo, useState } from "react";

import { tbo_workQueryableFieldNames } from "@/lib/typesense/collections";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";

export interface FacetValue {
	value: string;
	count: number;
}

interface UseFacetCountsParams {
	collectionName: string;
	searchQuery: string;
	facetFields: ReadonlyArray<string>;
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

	// Primitive key so the fetch only re-runs when the set of faceted fields actually changes,
	// regardless of the `facetFields` array identity.
	const facetFieldsKey = facetFields.join(",");

	useEffect(() => {
		let fetchMounted = true;

		const fetchFacetValues = async () => {
			const fieldNames = facetFieldsKey.split(",").filter(Boolean);
			if (fieldNames.length === 0) {
				return;
			}

			setIsFetching(true);
			try {
				const client = createTypesenseClient();

				const searchResults = await client
					.collections(collectionName)
					.documents()
					.search({
						q: searchQuery || "*",
						query_by: tbo_workQueryableFieldNames.join(","),
						facet_by: fieldNames.join(","),
						limit: 0,
						...(filterBy != null ? { filter_by: filterBy } : {}),
					});

				if (!fetchMounted) return;

				const next: Record<string, Array<FacetValue>> = {};
				for (const fieldName of fieldNames) {
					next[fieldName] =
						searchResults.facet_counts
							?.find((facetCount) => {
								return facetCount.field_name === fieldName;
							})
							?.counts.map((count) => {
								return { value: count.value, count: count.count };
							}) ?? [];
				}

				setFacetData((previous) => {
					return areFacetDataEqual(previous, next, fieldNames) ? previous : next;
				});
			} catch (error) {
				console.error("Failed to fetch facet values:", error);
				if (fetchMounted) {
					setFacetData({});
				}
			} finally {
				if (fetchMounted) {
					setIsFetching(false);
				}
			}
		};

		void fetchFacetValues();

		return () => {
			fetchMounted = false;
		};
	}, [collectionName, searchQuery, facetFieldsKey, filterBy]);

	const displayData = useMemo(() => {
		const result: Record<string, Array<FacetValue>> = {};

		for (const fieldName of facetFields) {
			const counts = facetData[fieldName] ?? [];
			const selected = selectedValues[fieldName];

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

			result[fieldName] = missing.length > 0 ? [...counts, ...missing] : counts;
		}

		return result;
	}, [facetFields, facetData, selectedValues]);

	return { displayData, isFetching };
}
