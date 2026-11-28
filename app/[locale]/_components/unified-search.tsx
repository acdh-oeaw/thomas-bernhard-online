"use client";

import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useMemo } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import type { SearchOptions, SearchResponseHit } from "typesense";

import { type SearchFilters, SearchResults } from "#/app/[locale]/_components/search-results.tsx";
import { yearFacetFilter } from "#/components/typesense/index.ts";
import type { CollectionHit } from "#/components/typesense/use-collection-search.ts";
import type { FacetCountsRequest } from "#/components/typesense/use-facet-counts.ts";
import { entityBrandStyle } from "#/config/ui.ts";
import {
	getItemFacetCounts,
	getItems,
	itemCollections,
	type ItemSearchParams,
	type UniversalSearchDocument,
	type UniversalSearchHit,
} from "#/lib/data.ts";
import { collections } from "#/lib/typesense/collections.ts";
import type { CollectionSearchParams } from "#/lib/typesense/search.ts";

import { EventResultCard } from "./event-result-card.tsx";
import { GroupResultCard } from "./group-result-card.tsx";
import { PerformanceResultCard } from "./performance-result-card.tsx";
import { PersonResultCard } from "./person-result-card.tsx";
import { PublicationResultCard } from "./publication-result-card.tsx";
import { TranslationResultCard } from "./translation-result-card.tsx";
import { WorkResultCard } from "./work-result-card.tsx";

const resultTypes = [
	"work",
	"person",
	"group",
	"translation",
	"manifestation",
	"performance",
	"event",
] as const;
type ResultType = (typeof resultTypes)[number];
const resultTabs = ["all", ...resultTypes] as const;
const resultTypeParser = parseAsStringLiteral(resultTabs).withDefault("all");

function isTranslationHit(
	hit: UniversalSearchHit,
): hit is SearchResponseHit<Extract<UniversalSearchDocument, { type: "translation" }>> {
	return hit.document.type === "translation";
}

function isManifestationHit(
	hit: UniversalSearchHit,
): hit is SearchResponseHit<Extract<UniversalSearchDocument, { type: "manifestation" }>> {
	return hit.document.type === "manifestation";
}

function isPerformanceHit(
	hit: UniversalSearchHit,
): hit is SearchResponseHit<Extract<UniversalSearchDocument, { type: "performance" }>> {
	return hit.document.type === "performance";
}

function isEventHit(
	hit: UniversalSearchHit,
): hit is SearchResponseHit<Extract<UniversalSearchDocument, { type: "event" }>> {
	return hit.document.type === "event";
}

function isGroupHit(
	hit: UniversalSearchHit,
): hit is SearchResponseHit<Extract<UniversalSearchDocument, { type: "group" }>> {
	return hit.document.type === "group";
}

function isPersonHit(
	hit: UniversalSearchHit,
): hit is SearchResponseHit<Extract<UniversalSearchDocument, { type: "person" }>> {
	return hit.document.type === "person";
}

/** Shared filter mapping for union hits and facet-only queries. */
function itemFilterParams(
	q: string | undefined,
	filters: SearchFilters,
	types: ReadonlySet<ResultType>,
): ItemSearchParams {
	const yearFilter =
		filters.yearFilters.size > 0
			? `(${Array.from(filters.yearFilters)
					.map((year) => {
						return yearFacetFilter(year);
					})
					.join(" || ")})`
			: undefined;
	const categoryFilter =
		filters.categoryFilters.size > 0
			? `(${Array.from(filters.categoryFilters)
					.map((category) => {
						const escaped = category.replaceAll("\\", "\\\\").replaceAll("`", "\\`");
						return `category:=\`${escaped}\``;
					})
					.join(" || ")})`
			: undefined;
	const workFilter = [categoryFilter, yearFilter].filter(Boolean).join(" && ");
	return {
		q: q === "" ? "*" : (q ?? "*"),
		types: Array.from(types),
		workFilterBy: workFilter === "" ? undefined : workFilter,
		translationFilterBy: yearFilter,
	};
}

export function UnifiedSearch(): ReactNode {
	const t = useTranslations("SearchResults");
	const [selectedType, setSelectedType] = useQueryState("types", resultTypeParser);
	const [, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
	const includedTypes = useMemo(() => {
		return new Set<ResultType>(selectedType === "all" ? resultTypes : [selectedType]);
	}, [selectedType]);
	const facetNames = useMemo(() => {
		return (["category", "year"] as const).filter((field) => {
			return Array.from(includedTypes).some((type) => {
				return (
					collections[itemCollections[type]].facetableFieldNames as ReadonlyArray<string>
				).includes(field);
			});
		});
	}, [includedTypes]);
	const queryKey = resultTypes
		.filter((type) => {
			return includedTypes.has(type);
		})
		.join(",");
	const resultLabel = t(`result-collection-${selectedType}`);
	const search = async (
		params: CollectionSearchParams<"work">,
		options: SearchOptions | undefined,
		filters: SearchFilters,
	) => {
		return getItems(
			{
				...itemFilterParams(params.q, filters, includedTypes),
				page: params.page,
				perPage: params.per_page,
				sortBy: params.sort_by,
			},
			options,
		);
	};

	return (
		<Tabs
			className="grid gap-y-8"
			onSelectionChange={(key) => {
				void setSelectedType(resultTypeParser.parse(String(key)) ?? "all");
				void setPage(1);
			}}
			selectedKey={selectedType}
		>
			<TabList
				aria-label={t("result-types")}
				className="flex flex-wrap border-b border-stroke-weak"
			>
				{resultTabs.map((type) => {
					return (
						<Tab
							key={type}
							className="interactive mx-1 cursor-pointer rounded-t-lg border border-b-2 border-(--entity-brand-outline) border-b-transparent bg-(--entity-brand-tint) px-4 py-2 text-small font-strong text-(--entity-brand-color) outline-transparent hover:hover-overlay focus-visible:focus-outline selected:border-b-(--entity-brand-color) selected:shadow-[inset_0_-2px_0_var(--entity-brand-color)]"
							id={type}
							style={entityBrandStyle(type === "all" ? "all" : itemCollections[type])}
						>
							{t(`result-type-${type}`)}
						</Tab>
					);
				})}
			</TabList>
			<TabPanel className="outline-transparent focus-visible:focus-outline" id={selectedType}>
				<SearchResults<UniversalSearchDocument>
					collectionName="work"
					facetNames={facetNames}
					facetSearch={(
						request: FacetCountsRequest,
						options: SearchOptions | undefined,
						filters: SearchFilters,
					) => {
						return getItemFacetCounts(
							itemFilterParams(request.searchQuery, filters, includedTypes),
							request.facetFields,
							options,
						);
					}}
					queryBy={collections.work.queryableFieldNames}
					queryKey={queryKey}
					renderHit={(hit: CollectionHit<UniversalSearchDocument>, displayMode) => {
						return isEventHit(hit) ? (
							<EventResultCard
								key={`event-${hit.document.id}`}
								displayMode={displayMode}
								hit={hit}
							/>
						) : isPerformanceHit(hit) ? (
							<PerformanceResultCard
								key={`performance-${hit.document.id}`}
								displayMode={displayMode}
								hit={hit}
							/>
						) : isManifestationHit(hit) ? (
							<PublicationResultCard
								key={`manifestation-${hit.document.id}`}
								displayMode={displayMode}
								hit={hit}
							/>
						) : isTranslationHit(hit) ? (
							<TranslationResultCard key={hit.document.id} displayMode={displayMode} hit={hit} />
						) : isGroupHit(hit) ? (
							<GroupResultCard
								key={`group-${hit.document.id}`}
								displayMode={displayMode}
								hit={hit}
							/>
						) : isPersonHit(hit) ? (
							<PersonResultCard
								key={`person-${hit.document.id}`}
								displayMode={displayMode}
								hit={hit}
							/>
						) : (
							<WorkResultCard key={hit.document.id} displayMode={displayMode} hit={hit} />
						);
					}}
					resultLabel={resultLabel}
					search={search}
				/>
			</TabPanel>
		</Tabs>
	);
}
