"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";

import { type FacetValue, useFacetCounts } from "@/components/typesense/use-facet-counts";
import { CheckBox } from "@/components/ui/checkbox";
import { CheckBoxGroup, CheckBoxList } from "@/components/ui/checkbox-group";
import { Label } from "@/components/ui/label";
import type { Collection, CollectionFacetableFieldName } from "@/lib/typesense/schema";
import type { CollectionName } from "@/lib/typesense/search";

const EMPTY_SELECTION = new Set<string>();

interface FacetCheckBoxListProps {
	label: string;
	values: ReadonlyArray<FacetValue>;
	selectedKeys: Set<string>;
	isLoading: boolean;
	onChange: (values: Set<string>) => void;
}

/**
 * A single facet rendered as a vertical `CheckBoxGroup`: one checkbox per facet value with its
 * result count.
 */
function FacetCheckBoxList(props: Readonly<FacetCheckBoxListProps>): ReactNode {
	const t = useTranslations("Typesense.FacetList");
	const { label, values, selectedKeys, isLoading, onChange } = props;

	const value = useMemo(() => {
		return Array.from(selectedKeys);
	}, [selectedKeys]);

	return (
		<CheckBoxGroup
			className="gap-y-2"
			onChange={(keys) => {
				onChange(new Set(keys));
			}}
			value={value}
		>
			<Label className="text-small font-strong text-text-strong">{label}</Label>
			<CheckBoxList className="gap-y-2">
				{values.length === 0 ? (
					<span className="text-small text-text-weak">
						{isLoading ? t("loading") : t("no-values")}
					</span>
				) : (
					values.map((item) => {
						return (
							<CheckBox
								key={item.value}
								className="w-full text-small"
								size="small"
								value={item.value}
							>
								<span className="flex-1 truncate text-left">{item.value}</span>
								<span className="shrink-0 text-tiny opacity-70">{item.count}</span>
							</CheckBox>
						);
					})
				)}
			</CheckBoxList>
		</CheckBoxGroup>
	);
}

interface FacetConfig<C extends Collection<ReadonlyArray<never>>> {
	fieldName: CollectionFacetableFieldName<C>;
	label: string;
	facetBy?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FacetListProps<C extends Collection<any>> {
	collection: C;
	collectionName: CollectionName;
	label: string;
	facets: ReadonlyArray<FacetConfig<C>>;
	selectedValues: Record<string, Set<string>>;
	onChange: (fieldName: string, values: Set<string>) => void;
	searchQuery: string;
	isLoading?: boolean;
}

/**
 * A vertical, multi-select facet list intended as a sidebar next to the search results: each
 * facetable field is rendered as a labelled group of checkboxes with result counts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FacetList<C extends Collection<any>>(
	props: Readonly<FacetListProps<C>>,
): ReactNode {
	const {
		collection: _collection,
		collectionName,
		label,
		facets,
		selectedValues,
		onChange,
		searchQuery,
		isLoading = false,
	} = props;

	const facetFields = useMemo(() => {
		return facets.map((facet) => {
			const fieldName = String(facet.fieldName);
			return { name: fieldName, query: facet.facetBy ?? fieldName };
		});
	}, [facets]);

	const { displayData, isFetching } = useFacetCounts({
		collectionName,
		facetFields,
		searchQuery,
		selectedValues,
	});

	return (
		<div className="grid gap-y-6">
			<h2 className="font-heading text-heading-4 font-strong text-text-strong">{label}</h2>
			{facets.map((facet) => {
				const fieldName = String(facet.fieldName);

				return (
					<FacetCheckBoxList
						key={fieldName}
						isLoading={isLoading || isFetching}
						label={facet.label}
						onChange={(values) => {
							onChange(fieldName, values);
						}}
						selectedKeys={selectedValues[fieldName] ?? EMPTY_SELECTION}
						values={displayData[fieldName] ?? []}
					/>
				);
			})}
		</div>
	);
}
