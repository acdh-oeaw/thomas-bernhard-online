import { glob } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { createUrl } from "@acdh-oeaw/lib";
import type { MetadataRoute } from "next";

import { env } from "#/config/env.config.ts";
import { locales } from "#/lib/i18n/locales.ts";
import { getPathname } from "#/lib/navigation/navigation.ts";

const baseUrl = env.NEXT_PUBLIC_APP_BASE_URL;

/**
 * Google supports up to 50.000 entries per sitemap file. Apps which need more than that can use
 * `generateSitemaps` to generate multiple sitemap files.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap#generating-a-sitemap-using-code-js-ts
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const cwd = join(process.cwd(), "app", "[locale]");
	const routes: Array<string> = [];

	for await (const page of glob("**/page.tsx", { cwd, withFileTypes: true })) {
		if (!page.isFile()) continue;

		const segments = relative(cwd, page.parentPath).split(sep);

		/** Dynamic routes are omitted. */
		if (
			segments.some((segment) => {
				return segment.startsWith("[") && segment.endsWith("]");
			})
		)
			continue;

		/** Route groups do not appear in URLs. */
		const urlSegments = segments.filter((segment) => {
			return !(segment.startsWith("(") && segment.endsWith(")"));
		});
		routes.push(`/${urlSegments.join("/")}`);
	}

	routes.sort((a, b) => {
		return a.localeCompare(b);
	});

	const entries = locales.flatMap((locale) => {
		return routes.map((pathname) => {
			return {
				url: String(createUrl({ baseUrl, pathname: getPathname({ href: { pathname }, locale }) })),
				/**
				 * Only add `lastmod` when the publication date is actually known. Don't use the build date
				 * instead.
				 */
				// lastModified: new Date(),
			};
		});
	});

	return entries;
}
