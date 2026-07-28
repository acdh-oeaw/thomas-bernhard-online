"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
	Autocomplete,
	Button,
	Dialog,
	DialogTrigger,
	Input,
	Label,
	ListBox,
	ListBoxItem,
	Popover,
	SearchField,
	type Selection,
} from "react-aria-components";

import { tbo_workQueryableFieldNames } from "@/lib/typesense/collections";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import type { Collection, CollectionFacetableFieldName } from "@/lib/typesense/schema";

// NOTE: Typesense data-fetching and Aria UI components are intentionally tightly coupled in this
// component. Separating them caused re-render cascades that made the ListBox lose focus/scroll
// position on every selection: parent updates state → FacetDropdown re-renders → new facet counts
// array → PopoverAutocomplete re-renders → ListBox re-renders → focus/scroll lost. By keeping
// both together, the ListBox uses defaultSelectedKeys (uncontrolled) and only syncs to parent
// via useEffect, preventing the render loop entirely.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FacetDropdownProps<C extends Collection<any>> {
	collection: C;
	collectionName: string;
	label: string;
	fieldName: CollectionFacetableFieldName<C>;
	selectedValues: Set<string>;
	searchQuery: string;
	otherFilters?: Set<string>;
	onChange: (selectedValues: Set<string>) => void;
	isLoading?: boolean;
	searchPlaceholder?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FacetDropdown<C extends Collection<any>>(
	props: Readonly<FacetDropdownProps<C>>,
): ReactNode {
	const t = useTranslations("FacetDropdown");
	const {
		collection: _collection,
		collectionName,
		label,
		fieldName,
		selectedValues,
		searchQuery,
		otherFilters,
		onChange,
		isLoading = false,
		// eslint-disable-next-line @eslint-react/no-unstable-default-props
		searchPlaceholder = t("filter-values"),
	} = props;

	const [internalSelected, setInternalSelected] = useState<Set<string>>(() => {
		return new Set(selectedValues);
	});
	const [searchInput, setSearchInput] = useState("");
	const [facetValues, setFacetValues] = useState<Array<{ value: string; count: number }>>([]);
	const [isFetchingFacets, setIsFetchingFacets] = useState(false);

	useEffect(() => {
		let fetchMounted = true;

		const fetchFacetValues = async () => {
			setIsFetchingFacets(true);
			try {
				const client = createTypesenseClient();

				const searchParams: Record<string, unknown> = {
					q: searchQuery || "*",
					query_by: tbo_workQueryableFieldNames.join(","),
					facet_by: fieldName,
					limit: 0,
				};

				if (otherFilters && otherFilters.size > 0) {
					const otherFilterArray = Array.from(otherFilters);
					if (otherFilterArray.length > 0) {
						const filterString = otherFilterArray.join(" && ");
						searchParams.filter_by = filterString;
					}
				}

				const searchResults = await client
					.collections(collectionName)
					.documents()
					.search(searchParams);

				if (!fetchMounted) return;

				if (searchResults.facet_counts) {
					const facetCounts =
						searchResults.facet_counts
							.find((fc) => {
								return fc.field_name === String(fieldName);
							})
							?.counts.map((c) => {
								return {
									value: c.value,
									count: c.count,
								};
							}) ?? [];

					setFacetValues((prev) => {
						// Only update if the contents actually changed
						if (
							prev.length === facetCounts.length &&
							prev.every((p, i) => {
								return p.value === facetCounts[i]!.value && p.count === facetCounts[i]!.count;
							})
						) {
							return prev;
						}
						return facetCounts;
					});
				} else {
					setFacetValues((prev) => {
						return prev.length === 0 ? prev : [];
					});
				}
			} catch (error) {
				console.error(`Failed to fetch facet values for ${String(fieldName)}:`, error);
				if (fetchMounted) {
					setFacetValues([]);
				}
			} finally {
				if (fetchMounted) {
					setIsFetchingFacets(false);
				}
			}
		};

		void fetchFacetValues();

		return () => {
			fetchMounted = false;
		};
	}, [collectionName, fieldName, searchQuery, otherFilters]);

	const selectedCount = internalSelected.size;

	const buttonLabel = useMemo(() => {
		if (selectedCount === 0) {
			return t("options-count", { count: facetValues.length });
		}

		return Array.from(internalSelected)
			.map((value) => {
				const facetValue = facetValues.find((item) => {
					return item.value === value;
				});

				return facetValue != null ? `${value} (${String(facetValue.count)})` : value;
			})
			.join(", ");
	}, [facetValues, internalSelected, selectedCount, t]);

	const filteredValues = useMemo(() => {
		return facetValues.filter((item) => {
			return !searchInput || item.value.toLowerCase().includes(searchInput.toLowerCase());
		});
	}, [facetValues, searchInput]);

	useEffect(() => {
		onChange(internalSelected);
	}, [internalSelected, onChange]);

	return (
		<div className="grid gap-y-2">
			<Label className="text-small font-strong text-text-strong">{label}</Label>
			<DialogTrigger>
				<Button
					className="interactive flex w-fit items-center justify-between rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong hover:hover-overlay focus-visible:focus-outline disabled:opacity-50"
					isDisabled={isLoading || isFetchingFacets}
				>
					<span className="truncate">{buttonLabel}</span>
					<ChevronDownIcon aria-hidden={true} className="size-4 shrink-0" data-slot="icon" />
				</Button>
				<Popover>
					<Dialog
						className="space-y-2 rounded-2 border border-stroke-weak bg-background-raised p-3 shadow-raised"
						role="dialog"
					>
						<Autocomplete inputValue={searchInput} onInputChange={setSearchInput}>
							<SearchField className="relative">
								<Label className="sr-only">{t("search")}</Label>
								<div className="relative flex items-center">
									<Input
										className="interactive w-full rounded-1 border border-stroke-weak bg-background-raised px-3 py-2 pl-10 text-small outline-transparent placeholder:text-text-weak hover:hover-overlay focus-visible:focus-outline"
										placeholder={searchPlaceholder}
									/>
									<SearchIcon
										aria-hidden="true"
										className="pointer-events-none absolute left-3 size-4 text-icon-neutral"
										data-slot="icon"
									/>
								</div>
							</SearchField>

							{isFetchingFacets ? (
								<div className="px-3 py-2 text-small text-text-weak">{t("loading")}</div>
							) : filteredValues.length === 0 ? (
								<div className="px-3 py-2 text-small text-text-weak">{t("no-results")}</div>
							) : (
								<ListBox
									autoFocus="first"
									className="max-h-48 divide-y divide-stroke-weak overflow-y-auto"
									defaultSelectedKeys={internalSelected}
									escapeKeyBehavior="none"
									onSelectionChange={(keys: Selection) => {
										const newSelected = new Set<string>();
										if (typeof keys === "object" && Symbol.iterator in keys) {
											for (const key of keys) {
												newSelected.add(String(key));
											}
										}
										setInternalSelected(newSelected);
									}}
									selectionMode="multiple"
									shouldFocusWrap={true}
								>
									{filteredValues.map((item) => {
										return (
											<ListBoxItem
												key={item.value}
												className="interactive flex cursor-pointer items-center gap-x-3 px-3 py-2 outline-transparent hover:hover-overlay focus-visible:focus-outline"
												id={item.value}
												textValue={item.value}
											>
												<div
													className={`size-4 shrink-0 rounded-sm border ${
														internalSelected.has(item.value)
															? "border-stroke-brand-strong bg-fill-brand-strong"
															: "border-stroke-weak"
													}`}
												>
													{internalSelected.has(item.value) && (
														<CheckIcon
															aria-hidden={true}
															className="size-full text-text-inverse-strong"
															data-slot="icon"
														/>
													)}
												</div>
												<span className="flex-1 truncate">{item.value}</span>
												<span className="shrink-0 text-tiny text-text-weak">{item.count}</span>
											</ListBoxItem>
										);
									})}
								</ListBox>
							)}

							<Button
								className="interactive w-full py-2 text-center text-small text-text-brand outline-transparent hover:hover-overlay focus-visible:focus-outline disabled:opacity-50"
								isDisabled={selectedCount === 0}
								onPress={() => {
									setInternalSelected(new Set());
								}}
							>
								{t("clear-selection")}
							</Button>
						</Autocomplete>
					</Dialog>
				</Popover>
			</DialogTrigger>
		</div>
	);
}
