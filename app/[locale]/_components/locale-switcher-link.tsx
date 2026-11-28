"use client";

import type { ReactNode } from "react";

import { Link } from "#/components/link.tsx";
import type { IntlLocale } from "#/lib/i18n/locales.ts";
import { createHref } from "#/lib/navigation/create-href.ts";
import { usePathname, useSearchParams } from "#/lib/navigation/navigation.ts";

interface LocaleSwitcherLinkProps {
	children: ReactNode;
	locale: IntlLocale;
}

export function LocaleSwitcherLink(props: Readonly<LocaleSwitcherLinkProps>): ReactNode {
	const { children, locale } = props;

	const pathname = usePathname();
	const searchParams = useSearchParams();

	return (
		<Link
			className="relative rounded-0.5 outline-transparent focus-visible:focus-outline"
			href={createHref({ pathname, searchParams })}
			locale={locale}
			replace={true}
			scroll={false}
		>
			{children}
		</Link>
	);
}

export function LocaleSwitcherLinkFallback(props: Readonly<LocaleSwitcherLinkProps>): ReactNode {
	const { children, locale } = props;

	const pathname = usePathname();

	return (
		<Link
			className="relative rounded-0.5 outline-transparent focus-visible:focus-outline"
			href={createHref({ pathname })}
			locale={locale}
			replace={true}
			scroll={false}
		>
			{children}
		</Link>
	);
}
