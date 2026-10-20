import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { NavLink } from "@/components/nav-link";
import { getSourceForEntityType } from "@/lib/data";
import type { CollectionName } from "@/lib/typesense/search";

interface SearchResultCardProps {
	href: string;
	header: ReactNode;
	subheader?: ReactNode;
	children?: ReactNode;
	image: string;
	entityType: CollectionName;
}

export function SearchResultCard(props: Readonly<SearchResultCardProps>): ReactNode {
	const { children, header, href, image, subheader, entityType } = props;
	const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(image)}/180/280`;
	const t = useTranslations("ResultCard");
	const source =
		entityType === "work" || entityType === "person" || entityType === "group"
			? undefined
			: getSourceForEntityType(entityType);

	return (
		<li>
			<NavLink href={href}>
				<article
					className="interactive grid h-96 grid-cols-2 grid-rows-[auto_minmax(0,1fr)] gap-x-8 gap-y-3 overflow-hidden rounded-4 border border-stroke-weak bg-background-raised p-8 shadow-raised outline-transparent hover:hover-overlay focus-visible:focus-outline"
					style={
						source == null
							? undefined
							: {
									borderColor: `color-mix(in srgb, ${source.color} 40%, var(--color-stroke-weak))`,
									backgroundColor: `color-mix(in srgb, ${source.color} 4%, var(--color-background-raised))`,
								}
					}
				>
					<p
						className="col-span-2 justify-self-end text-right text-tiny font-strong tracking-wide text-text-weak uppercase"
						style={source == null ? undefined : { color: source.color }}
					>
						{t(entityType)}
					</p>
					<div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-y-4">
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
						<div className="line-clamp-8 min-h-0 overflow-hidden">{children}</div>
					</div>
					<div className="flex min-h-0 min-w-0 items-center justify-center">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img alt="" className="max-h-full max-w-full object-contain" src={imageUrl} />
					</div>
				</article>
			</NavLink>
		</li>
	);
}
