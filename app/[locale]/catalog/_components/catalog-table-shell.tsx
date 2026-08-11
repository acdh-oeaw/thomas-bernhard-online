"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useRef } from "react";
import { Button, Cell, Row } from "react-aria-components";

import { type CollectionSearchState, Pagination } from "@/components/typesense";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import type { WorkCollectionName } from "@/lib/typesense/search";

import { formatCell } from "./format-cell";
import type { CatalogTableController } from "./use-catalog-table";

/** The `<Row>` elements for the current hits, shared verbatim by both table variants. */
export function catalogRows(
	hits: CollectionSearchState<WorkCollectionName>["hits"],
	columns: Array<string>,
): ReactNode {
	return hits.map((hit) => {
		return (
			<Row
				key={hit.document.id}
				className="border-b border-stroke-weak last:border-b-0"
				id={hit.document.id}
			>
				{columns.map((column) => {
					return (
						<Cell key={column} className="px-4 py-3 align-top text-text-weak">
							{formatCell((hit.document as Record<string, unknown>)[column])}
						</Cell>
					);
				})}
			</Row>
		);
	});
}

interface CatalogTableEmptyStateProps {
	isLoading: boolean;
	error: Error | null;
	onRetry: () => void;
}

/** The distinct loading / error / no-results states for an empty table body. */
export function CatalogTableEmptyState(props: Readonly<CatalogTableEmptyStateProps>): ReactNode {
	const { isLoading, error, onRetry } = props;
	const t = useTranslations("CatalogPage");
	const tLoading = useTranslations("Loading");
	const tSearch = useTranslations("Typesense.CollectionSearch");

	if (isLoading) {
		return (
			<div className="flex justify-center p-8">
				<LoadingIndicator aria-label={tLoading("loading")} size="small" />
			</div>
		);
	}
	if (error != null) {
		return (
			<div className="grid justify-items-center gap-y-3 p-8">
				<p className="text-small text-text-weak">{tSearch("error")}</p>
				<Button
					className="interactive rounded-2 border border-stroke-strong px-3 py-1.5 text-small font-strong text-text-strong outline-transparent hover:hover-overlay focus-visible:focus-outline"
					onPress={onRetry}
				>
					{tSearch("retry")}
				</Button>
			</div>
		);
	}
	return <p className="p-8 text-center text-small text-text-weak">{t("no-results")}</p>;
}

interface CatalogTableShellProps {
	table: CatalogTableController;
	/** Optional filter toolbar rendered above the table (used by the standard variant). */
	toolbar?: ReactNode;
	/** The `<Table>` element, built by each variant (their only real difference). */
	children: ReactNode;
}

/**
 * Chrome shared by both table variants: the scroll section, an optional filter toolbar, the
 * refetch-dimming overlay and the pager. Each variant supplies its own `<Table>` as `children`.
 */
export function CatalogTableShell(props: Readonly<CatalogTableShellProps>): ReactNode {
	const { table, toolbar, children } = props;
	const tLoading = useTranslations("Loading");
	const sectionRef = useRef<HTMLDivElement>(null);

	return (
		<div ref={sectionRef} className="grid gap-y-8">
			{toolbar != null ? <div className="flex flex-wrap items-center gap-4">{toolbar}</div> : null}

			<div className="relative overflow-x-auto rounded-4 border border-stroke-weak">
				{children}

				{table.isRefetching ? (
					<div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-8">
						<LoadingIndicator aria-label={tLoading("loading")} size="small" />
					</div>
				) : null}
			</div>

			<div className="flex justify-center">
				<Pagination
					currentPage={table.page}
					isLoading={table.isLoading}
					onPageChange={(nextPage) => {
						table.handlePageChange(nextPage);
						sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
					}}
					totalPages={table.totalPages}
				/>
			</div>
		</div>
	);
}
