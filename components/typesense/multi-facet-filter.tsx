"use client";

import { FilterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";
import {
	Button,
	Dialog,
	DialogTrigger,
	Label,
	Popover,
	type Selection,
	Tag,
	TagGroup,
	TagList,
} from "react-aria-components";

import { type FacetValue, useFacetCounts } from "@/components/typesense/use-facet-counts";
import type { Collection, CollectionFacetableFieldName } from "@/lib/typesense/schema";
import type { CollectionName } from "@/lib/typesense/search";

const EMPTY_SELECTION = new Set<string>();

function toStringSet(keys: Selection): Set<string> {
	const result = new Set<string>();

	if (keys !== "all") {
		for (const key of keys) {
			result.add(String(key));
		}
	}

	return result;
}

interface FacetTagGroupProps {
	label: string;
	values: ReadonlyArray<FacetValue>;
	selectedKeys: Set<string>;
	onSelectionChange: (values: Set<string>) => void;
}

/**
 * A single facet rendered as a React Aria multi-select `TagGroup`: one tag per facet value with
 * its result count. Modelled on the filter panel in the React Aria CRUD example.
 */
function FacetTagGroup(props: Readonly<FacetTagGroupProps>): ReactNode {
	const t = useTranslations("Typesense.MultiFacetFilter");
	const { label, values, selectedKeys, onSelectionChange } = props;

	return (
		<TagGroup
			className="grid gap-y-2"
			escapeKeyBehavior="none"
			onSelectionChange={(keys) => {
				onSelectionChange(toStringSet(keys));
			}}
			selectedKeys={selectedKeys}
			selectionMode="multiple"
		>
			<Label className="text-small font-strong text-text-strong">{label}</Label>
			<TagList
				className="flex flex-wrap gap-2"
				renderEmptyState={() => {
					return <span className="text-small text-text-weak">{t("no-values")}</span>;
				}}
			>
				{values.map((item) => {
					return (
						<Tag
							key={item.value}
							className="interactive flex cursor-pointer items-center gap-x-2 rounded-full border border-stroke-weak px-3 py-1 text-small text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline selected:border-stroke-brand-strong selected:bg-fill-brand-strong selected:text-text-inverse-strong"
							id={item.value}
							textValue={item.value}
						>
							<span className="truncate">{item.value}</span>
							<span className="shrink-0 text-tiny opacity-70">{item.count}</span>
						</Tag>
					);
				})}
			</TagList>
		</TagGroup>
	);
}

interface FacetConfig<C extends Collection<ReadonlyArray<never>>> {
	fieldName: CollectionFacetableFieldName<C>;
	label: string;
	facetBy?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface MultiFacetFilterProps<C extends Collection<any>> {
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
 * A single filter popover behind which several facetable fields are displayed as `TagGroup`s. Facet
 * counts for all fields are fetched together from typesense for the current search query.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MultiFacetFilter<C extends Collection<any>>(
	props: Readonly<MultiFacetFilterProps<C>>,
): ReactNode {
	const t = useTranslations("Typesense.MultiFacetFilter");
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

	const totalSelected = useMemo(() => {
		return facets.reduce((sum, facet) => {
			return sum + (selectedValues[String(facet.fieldName)]?.size ?? 0);
		}, 0);
	}, [facets, selectedValues]);

	const isEmpty = Object.values(displayData).every((values) => {
		return values.length === 0;
	});

	return (
		<DialogTrigger>
			<Button
				className="interactive flex w-fit items-center gap-x-2 rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong hover:hover-overlay focus-visible:focus-outline disabled:opacity-50"
				isDisabled={isLoading}
			>
				<FilterIcon aria-hidden={true} className="size-4 shrink-0" data-slot="icon" />
				<span>{label}</span>
				{totalSelected > 0 ? (
					<span className="grid min-w-5 place-content-center rounded-full bg-fill-brand-strong px-1 text-tiny text-text-inverse-strong">
						{totalSelected}
					</span>
				) : null}
			</Button>
			<Popover>
				<Dialog
					className="grid max-h-112 w-80 max-w-[calc(100vw-2rem)] gap-y-4 overflow-y-auto rounded-2 border border-stroke-weak bg-background-raised p-4 shadow-raised"
					role="dialog"
				>
					{isFetching && isEmpty ? (
						<p className="text-small text-text-weak">{t("loading")}</p>
					) : (
						facets.map((facet) => {
							const fieldName = String(facet.fieldName);

							return (
								<FacetTagGroup
									key={fieldName}
									label={facet.label}
									onSelectionChange={(values) => {
										onChange(fieldName, values);
									}}
									selectedKeys={selectedValues[fieldName] ?? EMPTY_SELECTION}
									values={displayData[fieldName] ?? []}
								/>
							);
						})
					)}

					{totalSelected > 0 ? (
						<Button
							className="interactive w-full rounded-1 py-2 text-center text-small text-text-brand outline-transparent hover:hover-overlay focus-visible:focus-outline"
							onPress={() => {
								for (const facet of facets) {
									onChange(String(facet.fieldName), new Set());
								}
							}}
						>
							{t("clear-all")}
						</Button>
					) : null}
				</Dialog>
			</Popover>
		</DialogTrigger>
	);
}
