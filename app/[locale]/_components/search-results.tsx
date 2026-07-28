"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { FacetDropdown, Pagination, ResultStatus } from "@/components/typesense";
import { tbo_workCollection, tbo_workQueryableFieldNames } from "@/lib/typesense/collections";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import type { CollectionDocument, SearchHighlight } from "@/lib/typesense/schema";

import { WorkResultCard } from "./work-result-card";

interface SearchResultsProps {
	collectionName: string;
}

type WorkDocument = CollectionDocument<typeof tbo_workCollection>;

type WorkDocumentWithHighlights = WorkDocument & {
	id: string;
	highlights?: Array<SearchHighlight<WorkDocument>>;
};

export function SearchResults(props: Readonly<SearchResultsProps>): ReactNode {
	const { collectionName } = props;
	const t = useTranslations("SearchResults");
	const [searchQuery, setSearchQuery] = useQueryState("q", {
		defaultValue: "",
		clearOnDefault: true,
	});
	const [categoryFilters, setCategoryFilters] = useQueryState(
		"categories",
		parseAsArrayOf(parseAsString).withDefault([]),
	);
	const [currentPage, setCurrentPage] = useQueryState("page", parseAsInteger.withDefault(1));

	const [documents, setDocuments] = useState<Array<WorkDocumentWithHighlights>>([]);
	const [totalDocuments, setTotalDocuments] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const perPage = 12;

	const selectedCategories = useMemo(() => {
		return new Set(categoryFilters);
	}, [categoryFilters]);

	useEffect(() => {
		// Trigger fetch when any of these change
		const fetchResults = async () => {
			setIsLoading(true);
			try {
				const client = createTypesenseClient();

				const categoryFilter =
					selectedCategories.size > 0
						? `(${Array.from(selectedCategories)
								.map((cat) => {
									return `category:="${cat}"`;
								})
								.join(" || ")})`
						: undefined;

				const searchResults = await client
					.collections<WorkDocument>(collectionName)
					.documents()
					.search({
						q: searchQuery || "*",
						query_by: tbo_workQueryableFieldNames.join(","),
						highlight_fields: tbo_workQueryableFieldNames.join(","),
						page: currentPage,
						per_page: perPage,
						...(categoryFilter != null ? { filter_by: categoryFilter } : {}),
					});

				const results =
					searchResults.hits?.map((hit) => {
						return {
							...hit.document,
							id: String((hit.document as Record<string, unknown>).id),
							highlights: hit.highlights,
						};
					}) ?? [];

				setDocuments(results);
				setTotalDocuments(searchResults.found || 0);
			} catch (error) {
				console.error("Failed to fetch search results:", error);
				setDocuments([]);
			} finally {
				setIsLoading(false);
			}
		};

		void fetchResults();
	}, [currentPage, selectedCategories, searchQuery, collectionName, perPage]);

	useEffect(() => {
		// Reset to page 1 when search query or filters change
		if (currentPage > 1) {
			void setCurrentPage(1);
		}
	}, [searchQuery, categoryFilters, currentPage, setCurrentPage]);

	const handlePageChange = useCallback(
		(page: number) => {
			void setCurrentPage(page);
		},
		[setCurrentPage],
	);

	const handleCategoryChange = useCallback(
		(newSelected: Set<string>) => {
			void setCategoryFilters(Array.from(newSelected));
		},
		[setCategoryFilters],
	);

	return (
		<section className="relative layout-subgrid gap-y-12 py-16 xs:py-24">
			<header className="grid max-w-text gap-y-4">
				<h1 className="font-heading text-heading-2 font-strong text-balance text-text-strong">
					{t("title")}
				</h1>
				<ResultStatus
					endIndex={(currentPage - 1) * perPage + documents.length}
					isLoading={isLoading}
					startIndex={(currentPage - 1) * perPage + 1}
					totalCount={totalDocuments}
				/>
			</header>
			<div className="flex max-w-text gap-4">
				<input
					aria-label={t("search-placeholder")}
					// eslint-disable-next-line better-tailwindcss/no-unknown-classes
					className="bg-background interactive w-full rounded-2 border border-stroke-weak px-4 py-3 pr-12 text-small outline-transparent placeholder:text-text-weak hover:hover-overlay focus-visible:focus-outline"
					onChange={(e) => {
						void setSearchQuery(e.target.value);
					}}
					placeholder={t("search-placeholder")}
					type="text"
					value={searchQuery}
				/>
				<div className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-icon-neutral">
					<SearchIcon aria-hidden="true" className="size-5" data-slot="icon" />
				</div>

				<FacetDropdown
					collection={tbo_workCollection}
					collectionName={collectionName}
					fieldName="category"
					isLoading={isLoading}
					label={t("category")}
					onChange={handleCategoryChange}
					searchPlaceholder={t("filter-categories")}
					searchQuery={searchQuery}
					selectedValues={selectedCategories}
				/>
			</div>

			{documents.length > 0 ? (
				<>
					<ul
						className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,28rem),1fr))] gap-8"
						role="list"
					>
						{documents.map((doc) => {
							return (
								<WorkResultCard
									key={doc.id}
									document={doc}
									highlights={doc.highlights}
									id={doc.id}
								/>
							);
						})}
					</ul>
					<div className="flex justify-center pt-8">
						<Pagination
							currentPage={currentPage}
							isLoading={isLoading}
							onPageChange={handlePageChange}
							totalPages={Math.ceil(totalDocuments / perPage)}
						/>
					</div>
				</>
			) : !isLoading ? (
				<div className="grid gap-y-4 rounded-4 border border-stroke-weak bg-background-raised p-8">
					<p className="text-small text-text-weak">{t("no-results")}</p>
				</div>
			) : null}
		</section>
	);
}
