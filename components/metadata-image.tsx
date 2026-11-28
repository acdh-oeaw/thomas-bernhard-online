import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import type { IntlLocale } from "#/lib/i18n/locales.ts";

interface MetadataImageProps {
	locale: IntlLocale;
	size: { width: number; height: number };
	title: string;
}

export async function MetadataImage(props: Readonly<MetadataImageProps>): Promise<ImageResponse> {
	const { locale, size, title } = props;
	const assets = join(process.cwd(), "public", "assets");

	/**
	 * Variable fonts are currently not supported by `satori`.
	 *
	 * @see https://github.com/vercel/satori/issues/162
	 */
	const [font, logo] = await Promise.all([
		readFile(join(assets, "fonts", "inter-semibold.ttf")),
		readFile(join(assets, "images", "logo-acdh-light.svg")),
	]);

	return new ImageResponse(
		<div
			lang={locale}
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 32,
				justifyContent: "center",
				alignItems: "center",
				width: "100%",
				height: "100%",
				padding: 16,
				backgroundColor: "#fff",
			}}
		>
			{/* oxlint-disable-next-line nextjs/no-img-element -- ImageResponse renders the logo into a PNG. */}
			<img
				alt=""
				height={234}
				src={`data:image/svg+xml;base64,${logo.toString("base64")}`}
				width={200}
			/>
			<div
				style={{
					fontWeight: 600,
					fontSize: 48,
					textAlign: "center",
					textWrap: "balance",
					/** @see https://github.com/vercel/satori/issues/498 */
					wordBreak: "break-word",
				}}
			>
				{title}
			</div>
		</div>,
		{
			...size,
			fonts: [
				{
					data: font,
					name: "Inter",
					style: "normal",
					weight: 600,
				},
			],
		},
	);
}
