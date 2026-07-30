"use client";

import { ArrowDownAZIcon, ArrowDownZAIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	parseAsArrayOf,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
	useQueryState,
} from "nuqs";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Label, Radio, RadioGroup } from "react-aria-components";

import {
	FacetDropdown,
	FacetList,
	MultiFacetFilter,
	OrderBy,
	Pagination,
	ResultStatus,
} from "@/components/typesense";
import { SearchInput } from "@/components/ui/search-input";
import { abortableEffect } from "@/lib/abortable-effect";
import { collections } from "@/lib/typesense/collections";
import type { CollectionSearchHit } from "@/lib/typesense/schema";
import { type CollectionName, searchCollection } from "@/lib/typesense/search";

import { WorkResultCard } from "./work-result-card";

interface SearchResultsProps {
	collectionName: CollectionName;
}

const filterUiOptions = ["dropdown", "tags", "list"] as const;

const orderOptions = [
	{ value: "title:asc", labelKey: "order-title-asc", icon: ArrowDownAZIcon },
	{ value: "title:desc", labelKey: "order-title-desc", icon: ArrowDownZAIcon },
] as const;

const orderValues = orderOptions.map((option) => {
	return option.value;
});

const filterUiRadioClassName =
	"interactive flex cursor-pointer items-center rounded-2 border border-stroke-weak px-3 py-1.5 text-small text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline selected:border-stroke-brand-strong selected:bg-fill-brand-strong selected:text-text-inverse-strong";

const workCollection = collections.tbo_work.collection;

type WorkSearchHit = CollectionSearchHit<typeof workCollection>;

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
	const [filterUi, setFilterUi] = useQueryState(
		"ui",
		parseAsStringLiteral(filterUiOptions).withDefault("dropdown"),
	);
	const [sortBy, setSortBy] = useQueryState(
		"sort",
		parseAsStringLiteral(orderValues).withDefault("title:asc"),
	);

	const [hits, setHits] = useState<Array<WorkSearchHit>>([]);
	// Pagination status is read straight off the last search response.
	const [pagination, setPagination] = useState({ found: 0, page: 1, perPage: 0 });
	// Starts true because a search is always run on mount; avoids a flash of "no results".
	const [isLoading, setIsLoading] = useState(true);

	const selectedCategories = useMemo(() => {
		return new Set(categoryFilters);
	}, [categoryFilters]);

	useEffect(() => {
		return abortableEffect(async (signal) => {
			setIsLoading(true);
			try {
				const categoryFilter =
					selectedCategories.size > 0
						? `(${Array.from(selectedCategories)
								.map((cat) => {
									return `category:="${cat}"`;
								})
								.join(" || ")})`
						: undefined;

				const searchResults = await searchCollection(
					collectionName,
					{
						q: searchQuery || "*",
						query_by: collections.tbo_work.searchableFieldNames,
						highlight_full_fields: ["title"],
						page: currentPage,
						sort_by: ["_text_match:desc", sortBy],
						...(categoryFilter != null ? { filter_by: categoryFilter } : {}),
					},
					{ abortSignal: signal },
				);

				if (signal.aborted) return;

				setHits(searchResults.hits ?? []);
				setPagination({
					found: searchResults.found,
					page: searchResults.page,
					perPage: searchResults.request_params.per_page ?? 0,
				});
			} catch (error) {
				// A superseded request rejects with an abort error; ignore it.
				if (signal.aborted) return;
				console.error("Failed to fetch search results:", error);
				setHits([]);
				setPagination({ found: 0, page: 1, perPage: 0 });
			} finally {
				if (!signal.aborted) {
					setIsLoading(false);
				}
			}
		});
	}, [currentPage, selectedCategories, searchQuery, sortBy, collectionName]);

	const sectionRef = useRef<HTMLElement>(null);

	const handlePageChange = useCallback(
		(page: number) => {
			void setCurrentPage(page);
			sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		},
		[setCurrentPage],
	);

	const handleSearchChange = useCallback(
		(value: string) => {
			void setSearchQuery(value);
			// A changed query means a new result set, so return to the first page.
			void setCurrentPage(1);
		},
		[setSearchQuery, setCurrentPage],
	);

	const facets = useMemo(() => {
		return [{ fieldName: "category", label: t("category") }] as const;
	}, [t]);

	const orderByOptions = useMemo(() => {
		return orderOptions.map((option) => {
			return { value: option.value, label: t(option.labelKey), icon: option.icon };
		});
	}, [t]);

	const facetSelection = useMemo(() => {
		return { category: selectedCategories };
	}, [selectedCategories]);

	const handleFacetChange = useCallback(
		(fieldName: string, values: Set<string>) => {
			if (fieldName === "category") {
				void setCategoryFilters(Array.from(values));
				// A changed filter means a new result set, so return to the first page.
				void setCurrentPage(1);
			}
		},
		[setCategoryFilters, setCurrentPage],
	);

	const resultsContent =
		hits.length > 0 ? (
			<>
				<ul
					className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,28rem),1fr))] gap-8"
					role="list"
				>
					{hits.map((hit) => {
						return <WorkResultCard key={hit.document.id} hit={hit} />;
					})}
				</ul>
				<div className="flex justify-center pt-8">
					<Pagination
						currentPage={currentPage}
						isLoading={isLoading}
						onPageChange={handlePageChange}
						totalPages={Math.ceil(pagination.found / pagination.perPage)}
					/>
				</div>
			</>
		) : !isLoading ? (
			<div className="grid gap-y-4 rounded-4 border border-stroke-weak bg-background-raised p-8">
				<p className="text-small text-text-weak">{t("no-results")}</p>
			</div>
		) : null;

	return (
		<section ref={sectionRef} className="relative layout-subgrid gap-y-12 py-16 xs:py-24">
			<RadioGroup
				className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2"
				onChange={(value) => {
					void setFilterUi(value === "tags" ? "tags" : value === "list" ? "list" : "dropdown");
				}}
				orientation="horizontal"
				value={filterUi}
			>
				<Label className="text-small font-strong text-text-strong">{t("filter-ui")}</Label>
				<Radio className={filterUiRadioClassName} value="dropdown">
					{t("filter-ui-dropdown")}
				</Radio>
				<Radio className={filterUiRadioClassName} value="tags">
					{t("filter-ui-tags")}
				</Radio>
				<Radio className={filterUiRadioClassName} value="list">
					{t("filter-ui-list")}
				</Radio>
			</RadioGroup>

			<header className="grid max-w-text gap-y-4">
				<h1 className="font-heading text-heading-2 font-strong text-balance text-text-strong">
					{t("title")}
				</h1>
				<ResultStatus
					endIndex={(pagination.page - 1) * pagination.perPage + hits.length}
					isLoading={isLoading}
					startIndex={(pagination.page - 1) * pagination.perPage + 1}
					totalCount={pagination.found}
				/>
			</header>
			<div className="flex max-w-text flex-wrap items-center gap-4">
				<SearchInput
					aria-label={t("search-placeholder")}
					className="w-96 max-w-full"
					onChange={handleSearchChange}
					value={searchQuery}
				>
					<div className="flex items-center gap-x-3 rounded-2 border border-stroke-strong bg-fill-inverse-strong px-4 text-small text-text-strong focus-within:focus-outline">
						<SearchIcon
							aria-hidden="true"
							className="size-5 shrink-0 text-icon-neutral"
							data-slot="icon"
						/>
						<Input
							className="min-h-12 grow bg-transparent text-text-strong outline-transparent placeholder:text-text-weak"
							placeholder={t("search-placeholder")}
						/>
						<Button
							aria-label={t("clear-search")}
							className="shrink-0 rounded-1 p-1 text-icon-neutral outline-transparent group-data-empty:hidden hover:bg-fill-hover focus-visible:focus-outline"
						>
							<XIcon aria-hidden={true} className="size-4" data-slot="icon" />
						</Button>
					</div>
				</SearchInput>

				{filterUi === "tags" ? (
					<MultiFacetFilter
						collection={workCollection}
						collectionName={collectionName}
						facets={facets}
						isLoading={isLoading}
						label={t("filters")}
						onChange={handleFacetChange}
						searchQuery={searchQuery}
						selectedValues={facetSelection}
					/>
				) : filterUi === "dropdown" ? (
					<FacetDropdown
						collection={workCollection}
						collectionName={collectionName}
						fieldName="category"
						isLoading={isLoading}
						label={t("category")}
						onChange={(values) => {
							handleFacetChange("category", values);
						}}
						searchPlaceholder={t("filter-categories")}
						searchQuery={searchQuery}
						selectedValues={selectedCategories}
					/>
				) : null}

				<OrderBy
					label={t("order-by")}
					onChange={(value) => {
						void setSortBy(value);
						// A changed order means a new result sequence, so return to the first page.
						void setCurrentPage(1);
					}}
					options={orderByOptions}
					value={sortBy}
				/>
			</div>

			{filterUi === "list" ? (
				<div className="flex flex-col gap-8 lg:flex-row lg:items-start">
					<aside className="lg:w-64 lg:shrink-0">
						<FacetList
							collection={workCollection}
							collectionName={collectionName}
							facets={facets}
							isLoading={isLoading}
							label={t("filters")}
							onChange={handleFacetChange}
							searchQuery={searchQuery}
							selectedValues={facetSelection}
						/>
					</aside>
					<div className="grid flex-1 gap-y-12">{resultsContent}</div>
				</div>
			) : (
				resultsContent
			)}
		</section>
	);
}
