"use client";

import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Breadcrumb, Breadcrumbs } from "react-aria-components";

import { TBNavLink } from "#/components/entity-links/tb-nav-link.tsx";
import type { Work } from "#/lib/data.ts";

export interface EntityBreadcrumbItem {
	label: ReactNode;
	href?: string;
}

interface EntityBreadcrumbsProps {
	items: ReadonlyArray<EntityBreadcrumbItem>;
}

interface WorkBreadcrumbProps extends EntityBreadcrumbsProps {
	work?: Pick<Work, "id" | "title" | "year">;
}

/** Renders a locale-aware breadcrumb for an entity hierarchy. */
export function EntityBreadcrumbs(props: Readonly<EntityBreadcrumbsProps>): ReactNode {
	const { items } = props;

	if (items.length < 2) {
		return null;
	}

	return (
		<Breadcrumbs className="flex flex-wrap items-center gap-2 text-small text-text-weak">
			{items.map((item, index) => {
				const isCurrent = index === items.length - 1;

				return (
					<Breadcrumb
						key={`${item.href ?? "current"}-${String(index)}`}
						className="flex items-center gap-x-2"
						id={`breadcrumb-${String(index)}`}
					>
						{index > 0 ? (
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

/** Prepends a formatted work, when available, to the entity trail. */
export function WorkBreadcrumb(props: Readonly<WorkBreadcrumbProps>): ReactNode {
	const { work, items } = props;

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
		/>
	);
}
