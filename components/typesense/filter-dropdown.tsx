"use client";

import { ChevronDownIcon, FilterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button, Dialog, DialogTrigger, Label, Popover } from "react-aria-components";

import type { CollectionName } from "@/lib/typesense/search";

interface FilterDropdownProps {
	collectionName: CollectionName;
	fieldName: string;
	label: string;
	selectedValues: Set<string>;
	onChange: (selectedValues: Set<string>) => void;
	isLoading?: boolean;
	/**
	 * Render a compact icon trigger (a filter icon plus a count badge when values are selected) with no
	 * visible label, instead of the default labelled text button. Use where the field name is already
	 * shown next to the control, e.g. inside a table column header.
	 */
	compact?: boolean;
}

/**
 * Placeholder filter control for columns that are NOT facetable. Facetable columns use
 * `FacetDropdown`, which reads live value counts from typesense; a non-facetable field (free-text,
 * numeric range, …) needs a different filter UI that has not been built yet. This skeleton mirrors
 * `FacetDropdown`'s prop shape (`collectionName` / `fieldName` / `label` / `selectedValues` /
 * `onChange`) so a real implementation can be dropped in without touching the call sites.
 */
export function FilterDropdown(props: Readonly<FilterDropdownProps>): ReactNode {
	const t = useTranslations("Typesense.FilterDropdown");
	const {
		// Unused until a real filter is implemented; kept so the prop contract matches `FacetDropdown`.
		collectionName: _collectionName,
		fieldName,
		label,
		selectedValues,
		onChange: _onChange,
		isLoading = false,
		compact = false,
	} = props;

	const selectedCount = selectedValues.size;

	return (
		<div className="flex items-center gap-x-2">
			{compact ? null : <Label className="text-small font-strong text-text-strong">{label}</Label>}
			<DialogTrigger>
				<Button
					aria-label={compact ? label : undefined}
					className={
						compact
							? "interactive flex w-fit items-center gap-x-1.5 rounded-2 border border-stroke-weak bg-background-raised px-2 py-1.5 text-text-strong hover:hover-overlay focus-visible:focus-outline disabled:opacity-50"
							: "interactive flex w-fit items-center justify-between rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small font-normal text-text-strong hover:hover-overlay focus-visible:focus-outline disabled:opacity-50"
					}
					isDisabled={isLoading}
				>
					{compact ? (
						<>
							<FilterIcon aria-hidden={true} className="size-4 shrink-0" data-slot="icon" />
							{selectedCount > 0 ? (
								<span className="grid min-w-5 place-content-center rounded-full bg-fill-brand-strong px-1 text-tiny text-text-inverse-strong">
									{selectedCount}
								</span>
							) : null}
						</>
					) : (
						<>
							<span className="truncate">
								{selectedCount > 0 ? t("selected-count", { count: selectedCount }) : t("filter")}
							</span>
							<ChevronDownIcon aria-hidden={true} className="size-4 shrink-0" data-slot="icon" />
						</>
					)}
				</Button>
				<Popover>
					<Dialog
						className="max-w-64 space-y-2 rounded-2 border border-stroke-weak bg-background-raised p-3 shadow-raised"
						role="dialog"
					>
						<p className="text-small text-text-weak">
							{t("not-implemented", { field: fieldName })}
						</p>
					</Dialog>
				</Popover>
			</DialogTrigger>
		</div>
	);
}
