import type { ReactNode } from "react";

import { NavLink } from "@/components/nav-link";

interface SearchResultCardProps {
	href: string;
	header: ReactNode;
	subheader?: ReactNode;
	children?: ReactNode;
	image: string;
}

export function SearchResultCard(props: Readonly<SearchResultCardProps>): ReactNode {
	const { children, header, href, image, subheader } = props;
	const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(image)}/180/280`;

	return (
		<li>
			<NavLink href={href}>
				<article className="interactive grid h-96 grid-cols-2 grid-rows-1 gap-8 overflow-hidden rounded-4 border border-stroke-weak bg-background-raised p-8 shadow-raised outline-transparent hover:hover-overlay focus-visible:focus-outline">
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
