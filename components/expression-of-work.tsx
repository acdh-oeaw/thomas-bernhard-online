"use client";

import type { ReactNode } from "react";

import { TBNavLink } from "@/components/tb-nav-link";

interface ExpressionOfWorkProps {
	expressionTitle: string;
	originalTitle: string;
	expressionHref?: string;
	originalHref?: string;
}

export function ExpressionOfWork(props: Readonly<ExpressionOfWorkProps>): ReactNode {
	const { expressionTitle, originalTitle, expressionHref, originalHref } = props;

	return (
		<>
			{expressionHref ? (
				<TBNavLink href={expressionHref}>{expressionTitle}</TBNavLink>
			) : (
				expressionTitle
			)}
			{" ["}
			{originalHref ? <TBNavLink href={originalHref}>{originalTitle}</TBNavLink> : originalTitle}
			{"]"}
		</>
	);
}
