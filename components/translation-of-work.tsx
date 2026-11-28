"use client";

import type { ReactNode } from "react";

import { TBNavLink } from "#/components/entity-links/tb-nav-link.tsx";

interface TranslationOfWorkProps {
	translationTitle: string;
	originalTitle: string;
	translationHref?: string;
	originalHref?: string;
}

export function TranslationOfWork(props: Readonly<TranslationOfWorkProps>): ReactNode {
	const { translationTitle, originalTitle, translationHref, originalHref } = props;

	return (
		<>
			{translationHref ? (
				<TBNavLink href={translationHref}>{translationTitle}</TBNavLink>
			) : (
				translationTitle
			)}
			{" ["}
			{originalHref ? <TBNavLink href={originalHref}>{originalTitle}</TBNavLink> : originalTitle}
			{"]"}
		</>
	);
}
