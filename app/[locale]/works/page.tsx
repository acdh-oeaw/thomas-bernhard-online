import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { NuqsProvider } from "@/app/[locale]/_components/nuqs-adapter";
import { WorkSearch } from "@/app/[locale]/_components/work-search";
import { MainContent } from "@/components/ui/main-content";
import type { IntlLocale } from "@/lib/i18n/locales";

interface WorksPageProps {
	params: Promise<{ locale: IntlLocale }>;
}

export function generateMetadata(
	_props: Readonly<WorksPageProps>,
	_parent: ResolvingMetadata,
): Metadata {
	return { title: "Works" };
}

export default async function WorksPage(props: Readonly<WorksPageProps>): Promise<ReactNode> {
	const { locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations("SearchResults");

	return (
		<MainContent className="layout-grid content-start">
			<section className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<h1 className="font-heading text-heading-2 font-strong text-balance text-text-strong">
					{t("title")}
				</h1>
				<p className="max-w-text text-pretty text-text-weak">{t("intro")}</p>
				<NuqsProvider>
					<WorkSearch />
				</NuqsProvider>
			</section>
		</MainContent>
	);
}
