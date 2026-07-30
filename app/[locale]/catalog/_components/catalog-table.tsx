"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Pagination } from "@/components/typesense";
import { abortableEffect } from "@/lib/abortable-effect";
import { collections } from "@/lib/typesense/collections";
import type { CollectionSearchHit } from "@/lib/typesense/schema";
import { type CollectionName, searchCollection } from "@/lib/typesense/search";

interface CatalogTableProps {
	collectionName: CollectionName;
}

const workCollection = collections.tbo_work.collection;

type WorkSearchHit = CollectionSearchHit<typeof workCollection>;

// One column per top-level field of the document schema: `id` plus every field whose name is not a
// nested (dotted) sub-field.
const columns = [
	"id",
	...workCollection.fields
		.filter((field) => {
			return !field.name.includes(".");
		})
		.map((field) => {
			return field.name;
		}),
];

// Only fields flagged sortable in the schema can be used in a typesense `sort_by`.
const sortableColumns = new Set<string>(collections.tbo_work.sortableFieldNames);

// Default to ascending order on the first sortable field defined in the schema.
const defaultSort = `${collections.tbo_work.sortableFieldNames[0]}:asc`;

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

	const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
	const [sortBy, setSortBy] = useQueryState("sort", parseAsString.withDefault(defaultSort));

	const [hits, setHits] = useState<Array<WorkSearchHit>>([]);
	// Pagination status is read straight off the last search response.
	const [pagination, setPagination] = useState({ found: 0, page: 1, perPage: 0 });
	// Starts true because a search is always run on mount; avoids a flash of "no results".
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		return abortableEffect(async (signal) => {
			setIsLoading(true);
			try {
				const results = await searchCollection(
					collectionName,
					{
						q: "*",
						query_by: collections.tbo_work.searchableFieldNames.join(","),
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

	const handleSort = useCallback(
		(column: string) => {
			const [field, direction] = sortBy.split(":");
			// Toggle direction when re-selecting the active column, otherwise start ascending.
			const nextDirection = field === column && direction === "asc" ? "desc" : "asc";
			void setSortBy(`${column}:${nextDirection}`);
			void setPage(1);
		},
		[sortBy, setSortBy, setPage],
	);

	const handlePageChange = useCallback(
		(nextPage: number) => {
			void setPage(nextPage);
			sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		},
		[setPage],
	);

	const totalPages = pagination.perPage > 0 ? Math.ceil(pagination.found / pagination.perPage) : 0;

	if (hits.length === 0) {
		return !isLoading ? <p className="text-small text-text-weak">{t("no-results")}</p> : null;
	}

	return (
		<div ref={sectionRef} className="grid gap-y-8">
			<div className="overflow-x-auto rounded-4 border border-stroke-weak">
				<table className="w-full border-collapse text-small">
					<thead>
						<tr className="border-b border-stroke-weak bg-background-raised text-left">
							{columns.map((column) => {
								const isSortable = sortableColumns.has(column);
								const isActive = isSortable && sortField === column;

								return (
									<th
										key={column}
										className="px-4 py-3 font-strong whitespace-nowrap text-text-strong"
										scope="col"
									>
										{isSortable ? (
											<button
												className="inline-flex items-center gap-x-1 rounded-1 outline-transparent hover:text-text-brand focus-visible:focus-outline"
												onClick={() => {
													handleSort(column);
												}}
												type="button"
											>
												{column}
												{isActive ? (
													sortDirection === "desc" ? (
														<ArrowDownIcon aria-hidden={true} className="size-4" data-slot="icon" />
													) : (
														<ArrowUpIcon aria-hidden={true} className="size-4" data-slot="icon" />
													)
												) : null}
											</button>
										) : (
											column
										)}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{hits.map((hit) => {
							return (
								<tr key={hit.document.id} className="border-b border-stroke-weak last:border-b-0">
									{columns.map((column) => {
										return (
											<td key={column} className="px-4 py-3 align-top text-text-weak">
												{formatCell((hit.document as Record<string, unknown>)[column])}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
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
