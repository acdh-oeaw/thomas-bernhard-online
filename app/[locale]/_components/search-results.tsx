"use client";

import {
	ArrowDownAZIcon,
	ArrowDownZAIcon,
	CalendarArrowDownIcon,
	CalendarArrowUpIcon,
	LayoutGridIcon,
	ListFilterIcon,
	ListIcon,
	SearchIcon,
	SparklesIcon,
	TagsIcon,
	XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
	parseAsArrayOf,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
	useQueryState,
} from "nuqs";
import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { Button, Input, Tooltip, TooltipTrigger } from "react-aria-components";
import type { DocumentSchema, SearchOptions } from "typesense";

import {
	FacetDropdown,
	FacetList,
	MultiFacetFilter,
	OrderBy,
	Pagination,
	ResultStatus,
	useCollectionSearch,
	YEAR_FACET_QUERY,
	yearFacetFilter,
} from "@/components/typesense";
import type {
	CollectionHit,
	CollectionSearchResult,
} from "@/components/typesense/use-collection-search";
import {
	FacetCountsContext,
	type FacetCountsRequest,
	type FacetCountsSearch,
} from "@/components/typesense/use-facet-counts";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { SearchInput } from "@/components/ui/search-input";
import { type SearchDisplayMode, searchDisplayModes } from "@/config/ui";
import { collections } from "@/lib/typesense/collections";
import type { CollectionSearchParams, WorkCollectionName } from "@/lib/typesense/search";

export interface SearchFilters {
	readonly categoryFilters: ReadonlySet<string>;
	readonly yearFilters: ReadonlySet<string>;
}

interface SearchResultsProps<D extends DocumentSchema & { id: string }> {
	collectionName: WorkCollectionName;
	queryBy: CollectionSearchParams<"work">["query_by"];
	queryKey?: string;
	resultLabel: string;
	facetNames?: ReadonlyArray<"category" | "year">;
	facetSearch?: (
		request: FacetCountsRequest,
		options: SearchOptions | undefined,
		filters: SearchFilters,
	) => ReturnType<FacetCountsSearch>;
	search: (
		params: CollectionSearchParams<"work">,
		options: SearchOptions | undefined,
		filters: SearchFilters,
	) => Promise<CollectionSearchResult<D>>;
	renderHit: (hit: CollectionHit<D>, displayMode: SearchDisplayMode) => ReactNode;
}

const filterUiOptions = ["dropdown", "tags", "list"] as const;
const filterUiIcons = {
	dropdown: ListFilterIcon,
	tags: TagsIcon,
	list: ListIcon,
};

const displayModeIcons = { list: ListIcon, card: LayoutGridIcon };

/** A typesense `field:direction` sort value mapped to its `Collection.sort` message key. */
type SortLabelKey<V extends string> = V extends `${infer Field}:${infer Direction}`
	? `${Field}-${Direction}`
	: V;

function sortLabelKey<V extends string>(value: V): SortLabelKey<V> {
	return value.replace(":", "-") as SortLabelKey<V>;
}

const orderOptions = [
	{ value: "_text_match:desc", icon: SparklesIcon },
	{ value: "title:asc", icon: ArrowDownAZIcon },
	{ value: "title:desc", icon: ArrowDownZAIcon },
	{ value: "year:asc", icon: CalendarArrowDownIcon },
	{ value: "year:desc", icon: CalendarArrowUpIcon },
] as const;

const orderValues = orderOptions.map((option) => {
	return option.value;
});

const defaultFacetNames = ["category", "year"] as const;

const workCollection = collections.work.collection;

export function SearchResults<D extends DocumentSchema & { id: string }>(
	props: Readonly<SearchResultsProps<D>>,
): ReactNode {
	const {
		collectionName,
		queryBy,
		queryKey = "",
		renderHit,
		resultLabel,
		search,
		facetNames = defaultFacetNames,
		facetSearch,
	} = props;
	const t = useTranslations("SearchResults");
	const tLoading = useTranslations("Loading");
	const tSearch = useTranslations("Typesense.CollectionSearch");
	// Reusable, collection-specific field/sort labels.
	const tField = useTranslations("Collection.field");
	const tSort = useTranslations("Collection.sort");
	const [searchQuery, setSearchQuery] = useQueryState("q", {
		defaultValue: "",
		clearOnDefault: true,
	});
	const [categoryFilters, setCategoryFilters] = useQueryState(
		"categories",
		parseAsArrayOf(parseAsString).withDefault([]),
	);
	const [yearFilters, setYearFilters] = useQueryState(
		"years",
		parseAsArrayOf(parseAsString).withDefault([]),
	);
	const [currentPage, setCurrentPage] = useQueryState("page", parseAsInteger.withDefault(1));
	const [filterUi, setFilterUi] = useQueryState(
		"ui",
		parseAsStringLiteral(filterUiOptions).withDefault("dropdown"),
	);
	const [sortBy, setSortBy] = useQueryState(
		"sort",
		parseAsStringLiteral(orderValues).withDefault("_text_match:desc"),
	);
	const [displayMode, setDisplayMode] = useQueryState(
		"display",
		parseAsStringLiteral(searchDisplayModes).withDefault("card"),
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
	const filterBy = facetFilter ?? "";
	// `useCollectionSearch` runs the query, aborts superseded requests and exposes a loading / error /
	// success state machine (see below). `pagination` reads found/page/perPage straight off it.
	const { status, hits, error, retry, ...pagination } = useCollectionSearch(
		collectionName,
		{
			q: searchQuery, // it works to pass an empty string here, even though it shouldn't
			query_by: queryBy,
			highlight_full_fields: ["title"],
			page: currentPage,
			sort_by: sortBy === "_text_match:desc" ? [sortBy] : ["_text_match:desc", sortBy],
			...(filterBy !== "" ? { filter_by: filterBy } : {}),
		},
		(params, options) => {
			return search(params, options, {
				categoryFilters: selectedCategories,
				yearFilters: selectedYears,
			});
		},
		queryKey,
	);
	const isLoading = status === "loading";
	const facetContext = useMemo(() => {
		return facetSearch == null
			? null
			: {
					queryKey: JSON.stringify([queryKey, categoryFilters, yearFilters]),
					search: (request: FacetCountsRequest, options?: SearchOptions) => {
						return facetSearch(request, options, {
							categoryFilters: selectedCategories,
							yearFilters: selectedYears,
						});
					},
				};
	}, [facetSearch, queryKey, categoryFilters, yearFilters, selectedCategories, selectedYears]);

	const sectionRef = useRef<HTMLDivElement>(null);

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
		return [
			{ fieldName: "category" as const, label: tField("category") },
			{ fieldName: "year" as const, label: tField("year"), facetBy: YEAR_FACET_QUERY },
		].filter((facet) => {
			return facetNames.includes(facet.fieldName);
		});
	}, [tField, facetNames]);

	const orderByOptions = useMemo(() => {
		return orderOptions.map((option) => {
			return {
				value: option.value,
				label:
					option.value === "_text_match:desc"
						? t("sort-relevance")
						: tSort(sortLabelKey(option.value)),
				icon: option.icon,
			};
		});
	}, [t, tSort]);

	const facetSelection = useMemo(() => {
		return { category: selectedCategories, year: selectedYears };
	}, [selectedCategories, selectedYears]);

	const handleFacetChange = useCallback(
		(fieldName: string, values: Set<string>) => {
			if (fieldName === "category") {
				void setCategoryFilters(Array.from(values));
			} else if (fieldName === "year") {
				void setYearFilters(Array.from(values));
			}
			// A changed filter means a new result set, so return to the first page.
			void setCurrentPage(1);
		},
		[setCategoryFilters, setCurrentPage, setYearFilters],
	);

	const resultsContent =
		isLoading && hits.length === 0 ? (
			<div className="flex justify-center p-8">
				<LoadingIndicator aria-label={tLoading("loading")} size="small" />
			</div>
		) : error != null ? (
			<div className="grid justify-items-start gap-y-4 rounded-4 border border-stroke-weak bg-background-raised p-8">
				<p className="text-small text-text-weak">{tSearch("error")}</p>
				<Button
					className="interactive rounded-2 border border-stroke-strong px-3 py-1.5 text-small font-strong text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline"
					onPress={retry}
				>
					{tSearch("retry")}
				</Button>
			</div>
		) : hits.length > 0 ? (
			<>
				<ul
					className={
						displayMode === "list"
							? "grid grid-cols-1 gap-4"
							: "grid grid-cols-1 gap-8 @min-[58rem]/results:grid-cols-2"
					}
					role="list"
				>
					{hits.map((hit) => {
						return renderHit(hit, displayMode);
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
		) : (
			<div className="grid gap-y-4 rounded-4 border border-stroke-weak bg-background-raised p-8">
				<p className="text-small text-text-weak">{t("no-results")}</p>
			</div>
		);

	const resultsWithToolbar = (
		<div className="@container/results grid gap-y-6">
			<div className="flex items-center justify-between gap-4">
				<ResultStatus
					endIndex={(pagination.page - 1) * pagination.perPage + hits.length}
					isLoading={isLoading}
					resultLabel={resultLabel}
					startIndex={(pagination.page - 1) * pagination.perPage + 1}
					totalCount={pagination.found}
				/>
				<div className="ml-auto flex shrink-0 items-center gap-4">
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
					<div aria-label={t("display-mode")} className="flex gap-2" role="group">
						{searchDisplayModes.map((mode) => {
							const Icon = displayModeIcons[mode];
							return (
								<TooltipTrigger key={mode} delay={300}>
									<Button
										aria-label={t(`display-mode-${mode}`)}
										aria-pressed={displayMode === mode}
										className="interactive flex size-9 cursor-pointer items-center justify-center rounded-2 border border-stroke-weak text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline aria-pressed:border-stroke-brand-strong aria-pressed:bg-fill-brand-strong aria-pressed:text-text-inverse-strong"
										onPress={() => {
											void setDisplayMode(mode);
										}}
									>
										<Icon aria-hidden={true} className="size-4" />
									</Button>
									<Tooltip className="z-50 rounded-2 border border-stroke-weak bg-background-raised p-3 text-small text-text-strong shadow-raised">
										{t(`display-mode-${mode}`)}
									</Tooltip>
								</TooltipTrigger>
							);
						})}
					</div>
				</div>
			</div>
			{resultsContent}
		</div>
	);

	return (
		<FacetCountsContext value={facetContext}>
			<div ref={sectionRef} className="grid gap-y-12">
				<div className="flex items-start gap-4">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
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

						{facets.length > 0 && filterUi === "tags" ? (
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
						) : facets.length > 0 && filterUi === "dropdown" ? (
							<>
								{facets.map((facet) => {
									return (
										<FacetDropdown
											key={facet.fieldName}
											collection={workCollection}
											collectionName={collectionName}
											facetBy={"facetBy" in facet ? facet.facetBy : undefined}
											fieldName={facet.fieldName}
											isLoading={isLoading}
											label={facet.label}
											onChange={(values) => {
												handleFacetChange(facet.fieldName, values);
											}}
											searchQuery={searchQuery}
											selectedValues={facetSelection[facet.fieldName]}
										/>
									);
								})}
							</>
						) : null}
					</div>
					<div
						aria-label={t("filter-ui")}
						className="ml-auto flex min-h-12 shrink-0 items-center gap-2"
						role="group"
					>
						{filterUiOptions.map((mode) => {
							const Icon = filterUiIcons[mode];
							return (
								<TooltipTrigger key={mode} delay={300}>
									<Button
										aria-label={t(`filter-ui-${mode}`)}
										aria-pressed={filterUi === mode}
										className="interactive flex size-9 cursor-pointer items-center justify-center rounded-2 border border-stroke-weak text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline aria-pressed:border-stroke-brand-strong aria-pressed:bg-fill-brand-strong aria-pressed:text-text-inverse-strong"
										onPress={() => {
											void setFilterUi(mode);
										}}
									>
										<Icon aria-hidden={true} className="size-4" />
									</Button>
									<Tooltip
										className="z-50 grid max-w-72 gap-1 rounded-2 border border-stroke-weak bg-background-raised p-3 text-small text-text-strong shadow-raised"
										placement="bottom end"
									>
										<strong className="font-strong">{t(`filter-ui-${mode}`)}</strong>
										<span className="text-text-weak">{t(`filter-ui-${mode}-intro`)}</span>
									</Tooltip>
								</TooltipTrigger>
							);
						})}
					</div>
				</div>

				{facets.length > 0 && filterUi === "list" ? (
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
						<div className="min-w-0 flex-1">{resultsWithToolbar}</div>
					</div>
				) : (
					resultsWithToolbar
				)}
			</div>
		</FacetCountsContext>
	);
}
