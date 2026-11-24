import { cn } from "@acdh-oeaw/style-variants";
import type { ReactNode } from "react";

import { Image } from "@/components/image";

interface LogoProps {
	className?: string;
	type?: "logo" | "text";
}

export function Logo(props: Readonly<LogoProps>): ReactNode {
	const { className, type = "logo" } = props;
	const assets =
		type === "text"
			? {
					light: "/assets/images/acdh_logo_with_text_blackmelt_2026.svg",
					dark: "/assets/images/acdh_logo_with_text_whitemelt_2026.svg",
					width: 730.05,
				}
			: {
					light: "/assets/images/logo-acdh-light.svg",
					dark: "/assets/images/logo-acdh-dark.svg",
					width: 188.44,
				};

	return (
		<>
			<Image
				alt=""
				aria-hidden={true}
				className={cn("block dark:hidden", className)}
				height={220.1}
				loading="eager"
				src={assets.light}
				width={assets.width}
			/>
			<Image
				alt=""
				aria-hidden={true}
				className={cn("hidden dark:block", className)}
				height={220.1}
				loading="eager"
				src={assets.dark}
				width={assets.width}
			/>
		</>
	);
}
