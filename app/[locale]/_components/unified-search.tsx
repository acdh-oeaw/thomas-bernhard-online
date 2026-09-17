"use client";

import { useTranslations } from "next-intl";
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { Label, type Selection, Tag, TagGroup, TagList } from "react-aria-components";
import type { SearchOptions, SearchResponseHit } from "typesense";

import { type SearchFilters, SearchResults } from "@/app/[locale]/_components/search-results";
import { yearFacetFilter } from "@/components/typesense";
import type { CollectionHit } from "@/components/typesense/use-collection-search";
import { getItems, type UniversalSearchDocument, type UniversalSearchHit } from "@/lib/data";
import { collections } from "@/lib/typesense/collections";
import type { CollectionSearchParams } from "@/lib/typesense/search";

import { ExpressionResultCard } from "./expression-result-card";
import { PersonResultCard } from "./person-result-card";
import { WorkResultCard } from "./work-result-card";

const resultTypes = ["work", "expression", "person"] as const;
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
	return "type" in hit.document && hit.document.type === "expression";
}

function isPersonHit(
	hit: UniversalSearchHit,
): hit is SearchResponseHit<Extract<UniversalSearchDocument, { name: string }>> {
	return "name" in hit.document;
}

export function UnifiedSearch(): ReactNode {
	const t = useTranslations("SearchResults");
	const [selectedTypeValues, setSelectedTypeValues] = useQueryState(
		"types",
		parseAsArrayOf(parseAsStringLiteral(resultTypes)).withDefault([]),
	);
	const selectedTypes = new Set<ResultType>(selectedTypeValues);
	const includedTypes = selectedTypes.size === 0 ? new Set(resultTypes) : selectedTypes;
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
		const yearFilter =
			filters.yearFilters.size > 0
				? `(${Array.from(filters.yearFilters)
						.map((year) => {
							return yearFacetFilter(year);
						})
						.join(" || ")})`
				: undefined;

		return getItems(
			{
				q: params.q,
				types: Array.from(includedTypes),
				workFilterBy: params.filter_by,
				expressionFilterBy: yearFilter,
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
								className="interactive flex cursor-pointer rounded-full border border-stroke-weak px-3 py-1 text-small text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline selected:border-stroke-brand-strong selected:bg-fill-brand-strong"
								id={type}
								textValue={type}
							>
								{t(`result-type-${type}`)}
							</Tag>
						);
					})}
				</TagList>
			</TagGroup>
			<SearchResults
				collectionName="work"
				queryBy={collections.work.queryableFieldNames}
				queryKey={queryKey}
				renderHit={(hit: CollectionHit<UniversalSearchDocument>) => {
					return isExpressionHit(hit) ? (
						<ExpressionResultCard key={hit.document.id} hit={hit} />
					) : isPersonHit(hit) ? (
						<PersonResultCard key={hit.document.id} hit={hit} />
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
