import type { ReactNode } from "react";

import type { Group } from "#/lib/data.ts";

import { TBNavLink } from "./tb-nav-link.tsx";

interface GroupLinkProps {
	group: Pick<Group, "id" | "name">;
}

export function GroupLink(props: Readonly<GroupLinkProps>): ReactNode {
	const { group } = props;

	return <TBNavLink href={`/group/${group.id}`}>{group.name}</TBNavLink>;
}
