"use client";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useId } from "react";
import { Radio, RadioGroup } from "react-aria-components";

import type { CollectionName } from "@/lib/typesense/search";

import { CatalogFilterTable } from "./catalog-filter-table";
import { CatalogTable } from "./catalog-table";

interface CatalogViewProps {
	collectionName: CollectionName;
}

const viewOptions = ["standard", "filters"] as const;

const radioClassName =
	"interactive flex cursor-pointer items-center rounded-2 border border-stroke-weak px-3 py-1.5 text-small text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline selected:border-stroke-brand-strong selected:bg-fill-brand-strong selected:text-text-inverse-strong";

/**
 * Wraps the two catalog table variants with a switcher (mirroring the search page's filter-UI
 * switcher). The choice is kept in the `view` url param.
 */
export function CatalogView(props: Readonly<CatalogViewProps>): ReactNode {
	const { collectionName } = props;
	const t = useTranslations("CatalogPage");
	const viewHeadingId = useId();
	const [view, setView] = useQueryState(
		"view",
		parseAsStringLiteral(viewOptions).withDefault("standard"),
	);

	return (
		<div className="grid gap-y-8">
			<div className="grid gap-y-4">
				<div className="grid gap-y-3">
					<h2 className="text-small font-strong text-text-strong" id={viewHeadingId}>
						{t("view")}
					</h2>
					<RadioGroup
						aria-labelledby={viewHeadingId}
						className="flex flex-wrap items-center gap-2"
						onChange={(value) => {
							void setView(value === "filters" ? "filters" : "standard");
						}}
						orientation="horizontal"
						value={view}
					>
						<Radio className={radioClassName} value="standard">
							{t("view-standard")}
						</Radio>
						<Radio className={radioClassName} value="filters">
							{t("view-filters")}
						</Radio>
					</RadioGroup>
				</div>

				<p className="max-w-text text-small text-pretty text-text-weak">
					{t(view === "filters" ? "intro-filters" : "intro-standard")}
				</p>
			</div>

			{view === "filters" ? (
				<CatalogFilterTable collectionName={collectionName} />
			) : (
				<CatalogTable collectionName={collectionName} />
			)}
		</div>
	);
}
