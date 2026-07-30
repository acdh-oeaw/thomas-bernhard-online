"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
	Cell,
	Column,
	Row,
	type SortDescriptor,
	Table,
	TableBody,
	TableHeader,
} from "react-aria-components";

import { Pagination } from "@/components/typesense";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { abortableEffect } from "@/lib/abortable-effect";
import { collections } from "@/lib/typesense/collections";
import type { CollectionSearchHit } from "@/lib/typesense/schema";
import { type CollectionName, searchCollectionUnchecked } from "@/lib/typesense/search";

interface CatalogTableProps {
	collectionName: CollectionName;
}

// A hit for whichever collection is being rendered.
type CatalogHit = CollectionSearchHit<(typeof collections)[CollectionName]["collection"]>;

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

	// Default to ascending order on the first sortable field defined in the schema.
	const defaultSort = `${collection.sortableFieldNames[0]}:asc`;

	const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
	const [sortBy, setSortBy] = useQueryState("sort", parseAsString.withDefault(defaultSort));

	const [hits, setHits] = useState<Array<CatalogHit>>([]);
	// Pagination status is read straight off the last search response.
	const [pagination, setPagination] = useState({ found: 0, page: 1, perPage: 0 });
	// Starts true because a search is always run on mount; avoids a flash of "no results".
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		return abortableEffect(async (signal) => {
			setIsLoading(true);
			try {
				// `sortBy` is a runtime string built from the active react-aria column, so the field-name
				// params can't be statically checked here — use the unchecked search variant.
				const results = await searchCollectionUnchecked(
					collectionName,
					{
						q: "*",
						query_by: collections[collectionName].searchableFieldNames.join(","),
						page,
						...(sortBy ? { sort_by: sortBy } : {}),
					},
					{ abortSignal: signal },
				);

				if (signal.aborted) return;

				setHits(results.hits ?? []);
				setPagination({
					found: results.found,
					page: results.page,
					perPage: results.request_params.per_page ?? 0,
				});
			} catch (error) {
				// A superseded request rejects with an abort error; ignore it.
				if (signal.aborted) return;
				console.error("Failed to fetch catalog results:", error);
				setHits([]);
				setPagination({ found: 0, page: 1, perPage: 0 });
			} finally {
				if (!signal.aborted) {
					setIsLoading(false);
				}
			}
		});
	}, [collectionName, page, sortBy]);

	const sectionRef = useRef<HTMLDivElement>(null);

	const [sortField, sortDirection] = sortBy.split(":");

	const sortDescriptor: SortDescriptor = {
		column: sortField ?? "",
		direction: sortDirection === "desc" ? "descending" : "ascending",
	};

	const handleSortChange = useCallback(
		(descriptor: SortDescriptor) => {
			const direction = descriptor.direction === "descending" ? "desc" : "asc";
			void setSortBy(`${String(descriptor.column)}:${direction}`);
			void setPage(1);
		},
		[setSortBy, setPage],
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
							return isLoading ? (
								<div className="flex justify-center p-8">
									<LoadingIndicator aria-label={tLoading("loading")} size="small" />
								</div>
							) : (
								<p className="p-8 text-center text-small text-text-weak">{t("no-results")}</p>
							);
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
