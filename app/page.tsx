import { defaultLocale } from "#/lib/i18n/locales.ts";
import { redirect } from "#/lib/navigation/navigation.ts";

/** This page only renders when the app is built statically with `output: "export"`. */
export default function RootPage(): void {
	redirect({ href: "/", locale: defaultLocale });
}
