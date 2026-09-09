"use client";

import { useTranslations } from "next-intl";
import {
	parseAsArrayOf,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
	useQueryState,
} from "nuqs";
import { useCallback, useMemo } from "react";

import {
	type CollectionSearchState,
	useCollectionSearch,
	yearFacetFilter,
} from "@/components/typesense";
import { collections } from "@/lib/typesense/collections";
import type { WorkCollectionName } from "@/lib/typesense/search";

type SortDirection = "asc" | "desc";

/**
 * All state and behaviour shared by the two catalog table variants (`CatalogTable` and
 * `CatalogFilterTable`): column derivation, the shared `page`/`sort`/`categories` url params, the
 * typesense query, and the sort/filter/pagination handlers. The variants differ only in how they
 * render the header and where filtering lives, so everything else lives here.
 */
export interface CatalogTableController {
	collection: (typeof collections)[WorkCollectionName];
	/** Column ids in display order: the synthetic `id`, then top-level fields by `queryableFieldNames`. */
	columns: Array<string>;
	/** Translated header label for a column, falling back to the raw name (e.g. the `id` column). */
	columnLabel: (column: string) => string;
	sortableColumns: Set<string>;
	facetableColumns: Set<string>;
	sortField: string | undefined;
	sortDirection: string | undefined;
	/** Sort `column` in `direction`, resetting to the first page. No-op for non-sortable columns. */
	applySort: (column: string, direction: SortDirection) => void;
	page: number;
	totalPages: number;
	handlePageChange: (nextPage: number) => void;
	selectedFacetValues: Record<string, Set<string>>;
	handleFacetChange: (fieldName: string, values: Set<string>) => void;
	search: CollectionSearchState<WorkCollectionName>;
	isLoading: boolean;
	isRefetching: boolean;
}

export function useCatalogTable(collectionName: WorkCollectionName): CatalogTableController {
	const tField = useTranslations("Collection.field");

	// Translate a column to its field label, falling back to the raw name for columns without one
	// (e.g. the synthetic `id` column, which is not a schema field).
	const columnLabel = (column: string): string => {
		const key = column as Parameters<typeof tField>[0];
		return tField.has(key) ? tField(key) : column;
	};

	const collection = collections[collectionName];

	// One column per top-level field of the document schema (fields whose name is not a nested,
	// dotted sub-field), plus the synthetic `id` column first.
	const topLevelFields = collection.collection.fields
		.filter((field) => {
			return !field.name.includes(".");
		})
		.map((field) => {
			return field.name;
		});
	const topLevelFieldSet = new Set<string>(topLevelFields);

	// Order the columns by the curated `queryableFieldNames` list (using each name's top-level
	// segment, so `authors.id` → `authors`) rather than raw schema order — this puts e.g. `title`
	// first. Top-level fields with no queryable descendant are appended in schema order.
	const queryableOrder = [
		...new Set(
			collection.queryableFieldNames.map((name) => {
				return name.replace(/\..*$/, "");
			}),
		),
	].filter((field) => {
		return topLevelFieldSet.has(field);
	});
	const columns = [
		"id",
		...queryableOrder,
		...topLevelFields.filter((field) => {
			return !queryableOrder.includes(field);
		}),
	];

	// Only fields flagged sortable in the schema can be used in a typesense `sort_by`.
	const sortableColumns = new Set<string>(collection.sortableFieldNames);
	// Columns for which typesense can supply value counts, so their filter can be a real `FacetDropdown`.
	const facetableColumns = new Set<string>(collection.facetableFieldNames);

	// Every valid `${sortableField}:${direction}` clause; deriving them from the typed
	// `sortableFieldNames` preserves the literal types `sort_by` requires.
	const sortOptions = collection.sortableFieldNames.flatMap((field) => {
		return [`${field}:asc`, `${field}:desc`] as const;
	});
	const defaultSort = `${collection.sortableFieldNames[0]}:asc` as const;

	const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
	// `parseAsStringLiteral` validates the url value against the known clauses.
	const [sortBy, setSortBy] = useQueryState(
		"sort",
		parseAsStringLiteral(sortOptions).withDefault(defaultSort),
	);
	const [categoryFilters, setCategoryFilters] = useQueryState(
		"categories",
		parseAsArrayOf(parseAsString).withDefault([]),
	);
	const [yearFilters, setYearFilters] = useQueryState(
		"years",
		parseAsArrayOf(parseAsString).withDefault([]),
	);
	const selectedCategories = useMemo(() => {
		return new Set(categoryFilters);
	}, [categoryFilters]);
	const selectedYears = useMemo(() => {
		return new Set(yearFilters);
	}, [yearFilters]);

	const facetFilterParts = [
		selectedCategories.size > 0
			? `(${Array.from(selectedCategories)
					.map((category) => {
						return `category:="${category}"`;
					})
					.join(" || ")})`
			: null,
		selectedYears.size > 0
			? `(${Array.from(selectedYears)
					.map((year) => {
						return yearFacetFilter(year);
					})
					.join(" || ")})`
			: null,
	].filter((part): part is string => {
		return part != null;
	});
	const facetFilter = facetFilterParts.length > 0 ? facetFilterParts.join(" && ") : undefined;

	// Runs the query, aborts superseded requests and exposes a loading / error / success state machine.
	const search = useCollectionSearch(collectionName, {
		page,
		sort_by: sortBy,
		...(facetFilter != null ? { filter_by: facetFilter } : {}),
	});
	const isLoading = search.status === "loading";

	const [sortField, sortDirection] = sortBy.split(":");

	const applySort = useCallback(
		(column: string, direction: SortDirection) => {
			// Recover the field's literal type from the typed schema list; this also guards against
			// columns that aren't actually sortable.
			const field = collection.sortableFieldNames.find((sortableField) => {
				return sortableField === column;
			});
			if (field == null) {
				return;
			}
			void setSortBy(`${field}:${direction}`);
			void setPage(1);
		},
		[collection, setSortBy, setPage],
	);

	const handleFacetChange = useCallback(
		(fieldName: string, values: Set<string>) => {
			if (fieldName === "category") {
				void setCategoryFilters(Array.from(values));
			} else if (fieldName === "year") {
				void setYearFilters(Array.from(values));
			}
			// A changed filter means a new result set, so return to the first page.
			void setPage(1);
		},
		[setCategoryFilters, setPage, setYearFilters],
	);

	const handlePageChange = useCallback(
		(nextPage: number) => {
			void setPage(nextPage);
		},
		[setPage],
	);

	const totalPages = search.perPage > 0 ? Math.ceil(search.found / search.perPage) : 0;

	// Keep the current rows visible but dim them while a re-sort/re-page request is in flight.
	const isRefetching = isLoading && search.hits.length > 0;

	return {
		collection,
		columns,
		columnLabel,
		sortableColumns,
		facetableColumns,
		sortField,
		sortDirection,
		applySort,
		page,
		totalPages,
		handlePageChange,
		selectedFacetValues: { category: selectedCategories, year: selectedYears },
		handleFacetChange,
		search,
		isLoading,
		isRefetching,
	};
}
