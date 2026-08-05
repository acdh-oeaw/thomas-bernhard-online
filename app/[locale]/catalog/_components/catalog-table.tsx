"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Column, type SortDescriptor, Table, TableBody, TableHeader } from "react-aria-components";

import { FacetDropdown } from "@/components/typesense";
import type { CollectionName } from "@/lib/typesense/search";

import { catalogRows, CatalogTableEmptyState, CatalogTableShell } from "./catalog-table-shell";
import { useCatalogTable } from "./use-catalog-table";

interface CatalogTableProps {
	collectionName: CollectionName;
}

/**
 * The default catalog table. It uses react-aria's native `allowsSorting`, so the whole column header
 * is the sort control and react-aria manages `aria-sort`, keyboard interaction and screen-reader
 * announcements. Because that makes the header itself the button, per-column filter controls can't
 * live inside it, so category filtering sits in a toolbar above the table. Compare `CatalogFilterTable`.
 */
export function CatalogTable(props: Readonly<CatalogTableProps>): ReactNode {
	const { collectionName } = props;
	const t = useTranslations("CatalogPage");
	const tField = useTranslations("Collection.field");
	const table = useCatalogTable(collectionName);
	const {
		collection,
		columns,
		columnLabel,
		sortableColumns,
		sortField,
		sortDirection,
		applySort,
		selectedCategories,
		handleCategoryChange,
		search,
		isLoading,
		isRefetching,
	} = table;

	const sortDescriptor: SortDescriptor = {
		column: sortField ?? "",
		direction: sortDirection === "desc" ? "descending" : "ascending",
	};

	const handleSortChange = (descriptor: SortDescriptor): void => {
		applySort(String(descriptor.column), descriptor.direction === "descending" ? "desc" : "asc");
	};

	return (
		<CatalogTableShell
			table={table}
			toolbar={
				<FacetDropdown
					collection={collection.collection}
					collectionName={collectionName}
					fieldName="category"
					isLoading={isLoading}
					label={tField("category")}
					onChange={handleCategoryChange}
					searchQuery=""
					selectedValues={selectedCategories}
				/>
			}
		>
			<Table
				aria-busy={isLoading}
				aria-label={t("title")}
				className={
					isRefetching
						? "w-full border-collapse text-small opacity-50 transition-opacity"
						: "w-full border-collapse text-small transition-opacity"
				}
				onSortChange={handleSortChange}
				sortDescriptor={sortDescriptor}
			>
				<TableHeader>
					{columns.map((column) => {
						return (
							<Column
								key={column}
								allowsSorting={sortableColumns.has(column)}
								className="cursor-default border-b border-stroke-weak bg-background-raised px-4 py-3 text-left font-strong whitespace-nowrap text-text-strong outline-transparent focus-visible:focus-outline allows-sorting:cursor-pointer"
								id={column}
								isRowHeader={column === "id"}
							>
								{(renderProps) => {
									return (
										<span className="inline-flex items-center gap-x-1">
											{columnLabel(column)}
											{renderProps.sortDirection === "ascending" ? (
												<ArrowDownIcon aria-hidden={true} className="size-4" data-slot="icon" />
											) : renderProps.sortDirection === "descending" ? (
												<ArrowUpIcon aria-hidden={true} className="size-4" data-slot="icon" />
											) : null}
										</span>
									);
								}}
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
