import type { Metadata } from "next";

import { type IntlLocale, locales } from "#/lib/i18n/locales.ts";
import { getPathname } from "#/lib/navigation/navigation.ts";

/**
 * Canonical url and `hreflang` alternates for a localized page.
 *
 * There is intentionally no default `canonical` in the root layout, so that not-found and error
 * pages don't get one. Every page should therefore set both `canonical` and `languages` via this
 * helper.
 *
 * Note that `next-intl` alternate links (via `link` response header) are disabled in favour of
 * this, because those would also be added to non-existent pages, and include an `x-default`
 * alternate, which we don't want, since we only redirect on "/".
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata#alternates
 */
export function getAlternates(locale: IntlLocale, pathname: string): Metadata["alternates"] {
	return {
		canonical: getPathname({ href: { pathname }, locale }),
		languages: Object.fromEntries(
			locales.map((locale) => {
				return [locale, getPathname({ href: { pathname }, locale })];
			}),
		),
	};
}
