import type { ReactNode } from "react";

import { NavLink } from "@/components/nav-link";

interface SearchResultCardProps {
	href: string;
	children: ReactNode;
}

export function SearchResultCard(props: Readonly<SearchResultCardProps>): ReactNode {
	const { href, children } = props;

	return (
		<li>
			<NavLink href={href}>
				<article className="interactive grid gap-y-4 rounded-4 border border-stroke-weak bg-background-raised p-8 shadow-raised outline-transparent hover:hover-overlay focus-visible:focus-outline">
					{children}
				</article>
			</NavLink>
		</li>
	);
}
