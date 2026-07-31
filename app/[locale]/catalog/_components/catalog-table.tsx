"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useCallback, useRef } from "react";
import {
	Button,
	Cell,
	Column,
	Row,
	type SortDescriptor,
	Table,
	TableBody,
	TableHeader,
} from "react-aria-components";

import { Pagination, useCollectionSearch } from "@/components/typesense";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { collections } from "@/lib/typesense/collections";
import type { CollectionName } from "@/lib/typesense/search";

interface CatalogTableProps {
	collectionName: CollectionName;
}

function formatCell(value: unknown): string {
	if (value == null) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value
			.map((item) => {
				return typeof item === "string" ? item : JSON.stringify(item);
			})
			.join(", ");
	}
	return JSON.stringify(value);
}

export function CatalogTable(props: Readonly<CatalogTableProps>): ReactNode {
	const { collectionName } = props;
	const t = useTranslations("CatalogPage");
	const tLoading = useTranslations("Loading");

	const collection = collections[collectionName];

	// One column per top-level field of the document schema: `id` plus every field whose name is not
	// a nested (dotted) sub-field.
	const columns = [
		"id",
		...collection.collection.fields
			.filter((field) => {
				return !field.name.includes(".");
			})
			.map((field) => {
				return field.name;
			}),
	];

	// Only fields flagged sortable in the schema can be used in a typesense `sort_by`.
	const sortableColumns = new Set<string>(collection.sortableFieldNames);

	// Every valid `${sortableField}:${direction}` clause for this collection. Deriving them from the
	// typed `sortableFieldNames` preserves their literal types, so `sortBy` stays assignable to
	// `searchCollection`'s `sort_by` without needing the unchecked escape hatch.
	const sortOptions = collection.sortableFieldNames.flatMap((field) => {
		return [`${field}:asc`, `${field}:desc`] as const;
	});
	type SortOption = (typeof sortOptions)[number];

	// Default to ascending order on the first sortable field defined in the schema.
	const defaultSort: SortOption = `${collection.sortableFieldNames[0]}:asc`;

	const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
	// `parseAsStringLiteral` validates the url value against the known clauses, so `sortBy` is always
	// a valid `SortOption` (falling back to `defaultSort` for anything else).
	const [sortBy, setSortBy] = useQueryState(
		"sort",
		parseAsStringLiteral(sortOptions).withDefault(defaultSort),
	);

	// Runs the query, aborts superseded requests and exposes a loading / error / success state
	// machine; `pagination` reads found/page/perPage straight off it.
	const { status, hits, error, retry, ...pagination } = useCollectionSearch(collectionName, {
		q: "*",
		query_by: collection.searchableFieldNames,
		page,
		sort_by: sortBy,
	});
	const isLoading = status === "loading";

	const sectionRef = useRef<HTMLDivElement>(null);

	const [sortField, sortDirection] = sortBy.split(":");

	const sortDescriptor: SortDescriptor = {
		column: sortField ?? "",
		direction: sortDirection === "desc" ? "descending" : "ascending",
	};

	const handleSortChange = useCallback(
		(descriptor: SortDescriptor) => {
			const direction = descriptor.direction === "descending" ? "desc" : "asc";
			// Recover the field's literal type from the typed schema list; this also guards against
			// columns that aren't actually sortable.
			const field = collection.sortableFieldNames.find((sortableField) => {
				return sortableField === descriptor.column;
			});
			if (field != null) {
				void setSortBy(`${field}:${direction}`);
				void setPage(1);
			}
		},
		[collection, setSortBy, setPage],
	);

	const handlePageChange = useCallback(
		(nextPage: number) => {
			void setPage(nextPage);
			sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		},
		[setPage],
	);

	const totalPages = pagination.perPage > 0 ? Math.ceil(pagination.found / pagination.perPage) : 0;

	// Keep the current rows visible but dim them while a re-sort/re-page request is in flight, so it
	// is clear the (still stale) content is being refreshed.
	const isRefetching = isLoading && hits.length > 0;

	return (
		<div ref={sectionRef} className="grid gap-y-8">
			<div className="relative overflow-x-auto rounded-4 border border-stroke-weak">
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
												{column}
												{renderProps.sortDirection === "ascending" ? (
													<ArrowUpIcon aria-hidden={true} className="size-4" data-slot="icon" />
												) : renderProps.sortDirection === "descending" ? (
													<ArrowDownIcon aria-hidden={true} className="size-4" data-slot="icon" />
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
							if (isLoading) {
								return (
									<div className="flex justify-center p-8">
										<LoadingIndicator aria-label={tLoading("loading")} size="small" />
									</div>
								);
							}
							if (error != null) {
								return (
									<div className="grid justify-items-center gap-y-3 p-8">
										<p className="text-small text-text-weak">{t("error")}</p>
										<Button
											className="interactive rounded-2 border border-stroke-strong px-3 py-1.5 text-small font-strong text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline"
											onPress={retry}
										>
											{t("retry")}
										</Button>
									</div>
								);
							}
							return <p className="p-8 text-center text-small text-text-weak">{t("no-results")}</p>;
						}}
					>
						{hits.map((hit) => {
							return (
								<Row
									key={hit.document.id}
									className="border-b border-stroke-weak last:border-b-0"
									id={hit.document.id}
								>
									{columns.map((column) => {
										return (
											<Cell key={column} className="px-4 py-3 align-top text-text-weak">
												{formatCell((hit.document as Record<string, unknown>)[column])}
											</Cell>
										);
									})}
								</Row>
							);
						})}
					</TableBody>
				</Table>

				{isRefetching ? (
					<div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-8">
						<LoadingIndicator aria-label={tLoading("loading")} size="small" />
					</div>
				) : null}
			</div>

			<div className="flex justify-center">
				<Pagination
					currentPage={page}
					isLoading={isLoading}
					onPageChange={handlePageChange}
					totalPages={totalPages}
				/>
			</div>
		</div>
	);
}
