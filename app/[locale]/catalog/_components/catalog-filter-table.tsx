"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button, Column, Table, TableBody, TableHeader } from "react-aria-components";

import { FacetDropdown, FilterDropdown } from "@/components/typesense";
import type { CollectionFacetableFieldName } from "@/lib/typesense/schema";
import type { CollectionName } from "@/lib/typesense/search";

import { catalogRows, CatalogTableEmptyState, CatalogTableShell } from "./catalog-table-shell";
import { useCatalogTable } from "./use-catalog-table";

interface CatalogFilterTableProps {
	collectionName: CollectionName;
}

// A stable empty selection for the not-yet-wired `FilterDropdown` skeletons.
const emptySelection = new Set<string>();

/**
 * Catalog table variant that folds a filter control into every column header — a live `FacetDropdown`
 * for facetable columns, the `FilterDropdown` skeleton for the rest. Because a filter button can't
 * sit inside react-aria's native sortable header (which is itself the sort button), sorting uses the
 * WAI-ARIA "sortable table" pattern instead: a custom sort button plus `aria-sort` on the column.
 * That is more compact but gives up react-aria's built-in sort keyboard/announcement handling.
 * Compare `CatalogTable`.
 */
export function CatalogFilterTable(props: Readonly<CatalogFilterTableProps>): ReactNode {
	const { collectionName } = props;
	const t = useTranslations("CatalogPage");
	const table = useCatalogTable(collectionName);
	const {
		collection,
		columns,
		columnLabel,
		sortableColumns,
		facetableColumns,
		sortField,
		sortDirection,
		applySort,
		selectedCategories,
		handleCategoryChange,
		search,
		isLoading,
		isRefetching,
	} = table;

	const toggleSort = (column: string): void => {
		const nextDirection = sortField === column && sortDirection === "asc" ? "desc" : "asc";
		applySort(column, nextDirection);
	};

	return (
		<CatalogTableShell table={table}>
			<Table
				aria-busy={isLoading}
				aria-label={t("title")}
				className={
					isRefetching
						? "w-full border-collapse text-small opacity-50 transition-opacity"
						: "w-full border-collapse text-small transition-opacity"
				}
			>
				<TableHeader>
					{columns.map((column) => {
						const isSortable = sortableColumns.has(column);
						const activeDirection = sortField === column ? sortDirection : null;
						return (
							<Column
								key={column}
								aria-sort={
									activeDirection === "asc"
										? "ascending"
										: activeDirection === "desc"
											? "descending"
											: isSortable
												? "none"
												: undefined
								}
								className="border-b border-stroke-weak bg-background-raised px-4 py-3 text-left align-middle font-strong whitespace-nowrap text-text-strong"
								id={column}
								isRowHeader={column === "id"}
							>
								<div className="flex items-center gap-x-2">
									{isSortable ? (
										<Button
											className="interactive inline-flex flex-1 cursor-pointer items-center gap-x-1 rounded-1 text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline"
											onPress={() => {
												toggleSort(column);
											}}
										>
											{columnLabel(column)}
											{activeDirection === "asc" ? (
												<ArrowDownIcon aria-hidden={true} className="size-4" data-slot="icon" />
											) : activeDirection === "desc" ? (
												<ArrowUpIcon aria-hidden={true} className="size-4" data-slot="icon" />
											) : null}
										</Button>
									) : (
										<span className="flex-1">{columnLabel(column)}</span>
									)}

									{column !== "id" ? (
										facetableColumns.has(column) ? (
											<FacetDropdown
												collection={collection.collection}
												collectionName={collectionName}
												compact={true}
												// Guarded by `facetableColumns.has`, so this column is a facetable field name.
												fieldName={
													column as CollectionFacetableFieldName<typeof collection.collection>
												}
												isLoading={isLoading}
												label={columnLabel(column)}
												onChange={handleCategoryChange}
												searchQuery=""
												selectedValues={selectedCategories}
											/>
										) : (
											<FilterDropdown
												collectionName={collectionName}
												compact={true}
												fieldName={column}
												isLoading={isLoading}
												label={columnLabel(column)}
												onChange={() => {
													// no-op until a real non-facet filter is implemented
												}}
												selectedValues={emptySelection}
											/>
										)
									) : null}
								</div>
							</Column>
						);
					})}
				</TableHeader>
				<TableBody
					renderEmptyState={() => {
						return (
							<CatalogTableEmptyState
								error={search.error}
								isLoading={isLoading}
								onRetry={search.retry}
							/>
						);
					}}
				>
					{catalogRows(search.hits, columns)}
				</TableBody>
			</Table>
		</CatalogTableShell>
	);
}
