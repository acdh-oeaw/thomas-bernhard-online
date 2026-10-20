"use client";

import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Breadcrumb, Breadcrumbs } from "react-aria-components";

import { TBNavLink } from "@/components/entity-links/tb-nav-link";
import type { SourceDefinition, Work } from "@/lib/data";

export interface EntityBreadcrumbItem {
	label: ReactNode;
	href?: string;
}

interface EntityBreadcrumbsProps {
	items: ReadonlyArray<EntityBreadcrumbItem>;
	source?: SourceDefinition;
}

interface WorkBreadcrumbProps extends EntityBreadcrumbsProps {
	work?: Pick<Work, "id" | "title" | "year">;
}

/** Renders a locale-aware breadcrumb for an entity hierarchy. */
export function EntityBreadcrumbs(props: Readonly<EntityBreadcrumbsProps>): ReactNode {
	const { items, source } = props;

	if (source == null && items.length < 2) {
		return null;
	}

	return (
		<Breadcrumbs className="flex flex-wrap items-center gap-2 text-small text-text-weak">
			{source != null ? (
				<Breadcrumb id="source">
					<span
						className="inline-flex rounded-full border-2 border-current px-3 py-1 font-strong"
						style={{
							color: source.color,
							backgroundColor: `color-mix(in srgb, ${source.color} 12%, transparent)`,
						}}
					>
						{source.name}
					</span>
				</Breadcrumb>
			) : null}
			{items.map((item, index) => {
				const isCurrent = index === items.length - 1;

				return (
					<Breadcrumb
						key={`${item.href ?? "current"}-${String(index)}`}
						className="flex items-center gap-x-2"
						id={`breadcrumb-${String(index)}`}
					>
						{index > 0 || source != null ? (
							<ChevronRightIcon aria-hidden={true} className="size-4 shrink-0" data-slot="icon" />
						) : null}
						{isCurrent ? (
							<span aria-current="page" className="text-text-strong">
								{item.label}
							</span>
						) : (
							<TBNavLink href={item.href}>{item.label}</TBNavLink>
						)}
					</Breadcrumb>
				);
			})}
		</Breadcrumbs>
	);
}

/** Prepends the source and, when available, a formatted work to the entity trail. */
export function WorkBreadcrumb(props: Readonly<WorkBreadcrumbProps>): ReactNode {
	const { work, items, source } = props;

	return (
		<EntityBreadcrumbs
			items={[
				...(work != null
					? [
							{
								href: `/work/${work.id}`,
								label: work.year != null ? `${work.title} (${String(work.year)})` : work.title,
							},
						]
					: []),
				...items,
			]}
			source={source}
		/>
	);
}
