"use client";

import { cn } from "@acdh-oeaw/style-variants";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { NavLink } from "@/components/nav-link";

type TBNavLinkProps = Omit<ComponentPropsWithRef<typeof NavLink>, "className"> & {
	className?: string;
};

export function TBNavLink(props: Readonly<TBNavLinkProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<NavLink
			{...rest}
			className={cn(
				"text-text-brand underline decoration-text-brand underline-offset-2 outline-transparent hover:no-underline focus-visible:focus-outline",
				className,
			)}
		/>
	);
}
