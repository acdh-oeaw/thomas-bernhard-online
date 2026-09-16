import type { ReactNode } from "react";

import type { Work } from "@/lib/data";

import { TBNavLink } from "./tb-nav-link";

interface WorkLinkProps {
	work: Pick<Work, "id" | "title" | "year">;
}

export function WorkLink(props: Readonly<WorkLinkProps>): ReactNode {
	const { work } = props;

	return (
		<TBNavLink href={`/work/${work.id}`}>
			{work.year != null ? `${work.title} (${String(work.year)})` : work.title}
		</TBNavLink>
	);
}
