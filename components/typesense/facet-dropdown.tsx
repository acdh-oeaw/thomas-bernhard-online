"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";
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

import { useFacetCounts } from "@/components/typesense/use-facet-counts";
import type { Collection, CollectionFacetableFieldName } from "@/lib/typesense/schema";
import type { CollectionName } from "@/lib/typesense/search";

// NOTE: The ListBox is uncontrolled (`defaultSelectedKeys`). Its selection is mirrored into local
// state and propagated to the parent from the selection handlers (not via a `useEffect` syncing on
// `onChange`, which loops when the parent passes an unstable `onChange`). Together with
// `useFacetCounts` keeping the facet list referentially stable, this avoids the re-render cascade
// that would otherwise make the ListBox lose focus/scroll position on every selection.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FacetDropdownProps<C extends Collection<any>> {
	collection: C;
	collectionName: CollectionName;
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

	const field = String(fieldName);

	const facetFields = useMemo(() => {
		return [field];
	}, [field]);

	const selectedByField = useMemo(() => {
		return { [field]: internalSelected };
	}, [field, internalSelected]);

	const filterBy =
		otherFilters != null && otherFilters.size > 0
			? Array.from(otherFilters).join(" && ")
			: undefined;

	const { displayData, isFetching } = useFacetCounts({
		collectionName,
		facetFields,
		filterBy,
		searchQuery,
		selectedValues: selectedByField,
	});

	const displayValues = useMemo(() => {
		return displayData[field] ?? [];
	}, [displayData, field]);

	const selectedCount = internalSelected.size;

	const buttonLabel = useMemo(() => {
		if (selectedCount === 0) {
			return t("options-count", { count: displayValues.length });
		}

		return Array.from(internalSelected)
			.map((value) => {
				const facetValue = displayValues.find((item) => {
					return item.value === value;
				});

				return `${value} (${String(facetValue?.count ?? 0)})`;
			})
			.join(", ");
	}, [displayValues, internalSelected, selectedCount, t]);

	const filteredValues = useMemo(() => {
		return displayValues.filter((item) => {
			return !searchInput || item.value.toLowerCase().includes(searchInput.toLowerCase());
		});
	}, [displayValues, searchInput]);

	const updateSelection = (values: Set<string>) => {
		setInternalSelected(values);
		onChange(values);
	};

	return (
		<div className="flex items-center gap-x-2">
			<Label className="text-small font-strong text-text-strong">{label}</Label>
			<DialogTrigger>
				<Button
					className="interactive flex w-fit items-center justify-between rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong hover:hover-overlay focus-visible:focus-outline disabled:opacity-50"
					isDisabled={isLoading || isFetching}
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

							{isFetching ? (
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
										updateSelection(newSelected);
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
									updateSelection(new Set());
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
