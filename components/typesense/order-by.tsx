"use client";

import type { LucideIcon } from "lucide-react";
import type { Key, ReactNode } from "react";
import { Select } from "react-aria-components";

import { Label } from "@/components/ui/label";
import { ListBox, ListBoxItem } from "@/components/ui/listbox";
import { Popover } from "@/components/ui/popover";
import { SelectTrigger, SelectValue } from "@/components/ui/select";

interface OrderByOption<T extends string> {
	value: T;
	label: string;
	/** Optional icon shown next to the label, both in the list and in the trigger. */
	icon?: LucideIcon;
}

interface OrderByProps<T extends string> {
	label: string;
	options: ReadonlyArray<OrderByOption<T>>;
	value: T;
	onChange: (value: T) => void;
}

/**
 * A labelled dropdown select over a set of `{ value, label, icon? }` options, with its selection
 * controlled by the parent. The `value` is intended to be used directly in a typesense `sort_by`
 * clause.
 */
export function OrderBy<T extends string>(props: Readonly<OrderByProps<T>>): ReactNode {
	const { label, options, value, onChange } = props;

	const selectedOption = options.find((option) => {
		return option.value === value;
	});
	const SelectedIcon = selectedOption?.icon;

	return (
		<Select
			className="group flex items-center gap-x-2"
			onChange={(key: Key | null) => {
				if (key != null) {
					onChange(String(key) as T);
				}
			}}
			value={value}
		>
			<Label className="sr-only">{label}</Label>
			<SelectTrigger>
				{/* Show only the selected option's icon; keep its label available to screen readers. */}
				<SelectValue className="slot-icon:size-5 slot-icon:shrink-0 slot-icon:text-icon-neutral">
					{SelectedIcon != null ? <SelectedIcon aria-hidden={true} data-slot="icon" /> : null}
					<span className="sr-only">{selectedOption?.label ?? ""}</span>
				</SelectValue>
			</SelectTrigger>
			<Popover>
				<ListBox className="min-w-48">
					{options.map((option) => {
						const Icon = option.icon;

						return (
							<ListBoxItem key={option.value} id={option.value} textValue={option.label}>
								{Icon != null ? <Icon aria-hidden={true} data-slot="icon" /> : null}
								{option.label}
							</ListBoxItem>
						);
					})}
				</ListBox>
			</Popover>
		</Select>
	);
}
