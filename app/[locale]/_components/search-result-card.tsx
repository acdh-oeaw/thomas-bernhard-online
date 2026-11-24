import { cn } from "@acdh-oeaw/style-variants";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { NavLink } from "@/components/nav-link";
import { entityBrandStyle, type SearchDisplayMode } from "@/config/ui";
import { itemCollections, type ItemType } from "@/lib/data";

interface SearchResultCardProps {
	href: string;
	header: ReactNode;
	subheader?: ReactNode;
	children?: ReactNode;
	image: string;
	entityType: ItemType;
	displayMode: SearchDisplayMode;
}

export function SearchResultCard(props: Readonly<SearchResultCardProps>): ReactNode {
	const { children, header, href, image, subheader, entityType, displayMode } = props;
	const isList = displayMode === "list";
	const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(image)}/180/280`;
	const t = useTranslations("ResultCard");

	return (
		<li>
			<NavLink href={href}>
				<article
					className={cn(
						"interactive grid overflow-hidden rounded-4 border border-t-4 border-(--entity-brand-border) border-t-(--entity-brand-color) bg-(--entity-brand-tint) shadow-raised outline-transparent hover:hover-overlay focus-visible:focus-outline",
						isList
							? "grid-cols-[minmax(0,1fr)_5rem] gap-x-4 gap-y-2 p-4"
							: "h-96 grid-cols-2 grid-rows-[auto_minmax(0,1fr)] gap-x-8 gap-y-3 p-8",
					)}
					data-display-mode={displayMode}
					style={entityBrandStyle(itemCollections[entityType])}
				>
					<p
						className={cn(
							"text-tiny font-strong tracking-wide text-(--entity-brand-color) uppercase",
							isList ? "col-start-1 row-start-1" : "col-span-2 justify-self-end text-right",
						)}
					>
						{t(entityType)}
					</p>
					<div
						className={cn(
							"grid min-h-0 min-w-0",
							isList ? "col-start-1 row-start-2 gap-y-2" : "grid-rows-[auto_minmax(0,1fr)] gap-y-4",
						)}
					>
						<header className="grid min-w-0 gap-y-1">
							<h2 className="line-clamp-2 min-w-0 font-heading text-heading-4 font-strong text-text-strong">
								{header}
							</h2>
							{subheader != null ? (
								<p className="line-clamp-2 min-w-0 font-heading text-heading-4 text-text-weak">
									{subheader}
								</p>
							) : null}
						</header>
						<div
							className={cn("min-h-0 overflow-hidden", isList ? "line-clamp-3" : "line-clamp-8")}
						>
							{children}
						</div>
					</div>
					<div
						className={cn(
							"flex min-h-0 min-w-0 items-center justify-center",
							isList && "col-start-2 row-span-2 row-start-1",
						)}
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							alt=""
							className={cn("max-w-full object-contain", isList ? "max-h-28" : "max-h-full")}
							src={imageUrl}
						/>
					</div>
				</article>
			</NavLink>
		</li>
	);
}
