"use client";

import { useTranslations } from "next-intl";
import { parseAsArrayOf, parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useMemo } from "react";
import { Label, type Selection, Tag, TagGroup, TagList } from "react-aria-components";
import type { SearchOptions, SearchResponseHit } from "typesense";

import { type SearchFilters, SearchResults } from "@/app/[locale]/_components/search-results";
import { yearFacetFilter } from "@/components/typesense";
import type { CollectionHit } from "@/components/typesense/use-collection-search";
import type { FacetCountsRequest } from "@/components/typesense/use-facet-counts";
import {
	getItemFacetCounts,
	getItems,
	itemCollections,
	type ItemSearchParams,
	type UniversalSearchDocument,
	type UniversalSearchHit,
} from "@/lib/data";
import { collections } from "@/lib/typesense/collections";
import type { CollectionSearchParams } from "@/lib/typesense/search";

import { ExpressionResultCard } from "./expression-result-card";
import { GroupResultCard } from "./group-result-card";
import { PerformanceResultCard } from "./performance-result-card";
import { PersonResultCard } from "./person-result-card";
import { PublicationResultCard } from "./publication-result-card";
import { WorkResultCard } from "./work-result-card";

const resultTypes = [
	"work",
	"person",
	"group",
	"expression",
	"manifestation",
	"performance",
] as const;
type ResultType = (typeof resultTypes)[number];

function selectionToSet(selection: Selection): Set<ResultType> {
	if (selection === "all") {
		return new Set(resultTypes);
	}

	const selectedKeys = new Set(Array.from(selection, String));
	return new Set(
		resultTypes.filter((type) => {
			return selectedKeys.has(type);
		}),
	);
}

function isExpressionHit(
	hit: UniversalSearchHit,
): hit is SearchResponseHit<Extract<UniversalSearchDocument, { type: "expression" }>> {
	return hit.document.type === "expression";
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
		expressionFilterBy: yearFilter,
	};
}

export function UnifiedSearch(): ReactNode {
	const t = useTranslations("SearchResults");
	const [selectedTypeValues, setSelectedTypeValues] = useQueryState(
		"types",
		parseAsArrayOf(parseAsStringLiteral(resultTypes)).withDefault([]),
	);
	const [, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
	const selectedTypes = useMemo(() => {
		return new Set<ResultType>(selectedTypeValues);
	}, [selectedTypeValues]);
	const includedTypes = useMemo(() => {
		return selectedTypes.size === 0 ? new Set(resultTypes) : selectedTypes;
	}, [selectedTypes]);
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
	const resultLabel = resultTypes
		.filter((type) => {
			return includedTypes.has(type);
		})
		.map((type) => {
			return t(`result-collection-${type}`);
		})
		.join(" & ");
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
		<div className="grid gap-y-8">
			<TagGroup
				aria-label={t("result-types")}
				className="grid gap-y-2"
				onSelectionChange={(selection) => {
					void setSelectedTypeValues(Array.from(selectionToSet(selection)));
					void setPage(1);
				}}
				selectedKeys={selectedTypes}
				selectionMode="multiple"
			>
				<Label className="text-small font-strong text-text-strong">{t("result-types")}</Label>
				<TagList className="flex flex-wrap gap-2">
					{resultTypes.map((type) => {
						return (
							<Tag
								key={type}
								className="interactive flex cursor-pointer rounded-full border-2 border-stroke-weak px-3 py-1 text-small text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline selected:border-stroke-brand-strong selected:bg-fill-brand-strong selected:text-text-inverse-strong"
								id={type}
								textValue={type}
							>
								{t(`result-type-${type}`)}
							</Tag>
						);
					})}
				</TagList>
			</TagGroup>
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
				renderHit={(hit: CollectionHit<UniversalSearchDocument>) => {
					return isPerformanceHit(hit) ? (
						<PerformanceResultCard key={`performance-${hit.document.id}`} hit={hit} />
					) : isManifestationHit(hit) ? (
						<PublicationResultCard key={`manifestation-${hit.document.id}`} hit={hit} />
					) : isExpressionHit(hit) ? (
						<ExpressionResultCard key={hit.document.id} hit={hit} />
					) : isGroupHit(hit) ? (
						<GroupResultCard key={`group-${hit.document.id}`} hit={hit} />
					) : isPersonHit(hit) ? (
						<PersonResultCard key={`person-${hit.document.id}`} hit={hit} />
					) : (
						<WorkResultCard key={hit.document.id} hit={hit} />
					);
				}}
				resultLabel={resultLabel}
				search={search}
			/>
		</div>
	);
}
