import type { ReactNode } from "react";

import { NavLink } from "@/components/nav-link";

interface SearchResultCardProps {
	href: string;
	children: ReactNode;
	image?: string;
}

export function SearchResultCard(props: Readonly<SearchResultCardProps>): ReactNode {
	const { href, children, image } = props;

	return (
		<li>
			<NavLink href={href}>
				<article
					className={`interactive grid h-96 grid-rows-1 overflow-hidden ${image != null ? "grid-cols-2 gap-8" : "gap-y-4"} rounded-4 border border-stroke-weak bg-background-raised p-8 shadow-raised outline-transparent hover:hover-overlay focus-visible:focus-outline`}
				>
					<div className="line-clamp-8 min-h-0 min-w-0 overflow-hidden">{children}</div>
					{image != null ? (
						<div className="flex min-h-0 min-w-0 items-center justify-center">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img alt="" className="max-h-full max-w-full object-contain" src={image} />
						</div>
					) : null}
				</article>
			</NavLink>
		</li>
	);
}
