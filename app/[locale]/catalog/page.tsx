import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { NuqsProvider } from "@/app/[locale]/_components/nuqs-adapter";
import { MainContent } from "@/components/ui/main-content";
import type { IntlLocale } from "@/lib/i18n/locales";

import { CatalogView } from "./_components/catalog-view";

interface CatalogPageProps {
	params: Promise<{
		locale: IntlLocale;
	}>;
}

export async function generateMetadata(
	props: Readonly<CatalogPageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { params } = props;

	const { locale } = await params;

	const t = await getTranslations({ locale, namespace: "CatalogPage" });

	return {
		title: t("meta.title"),
	};
}

export default async function CatalogPage(props: Readonly<CatalogPageProps>): Promise<ReactNode> {
	const { params } = props;

	const { locale } = await params;

	setRequestLocale(locale);

	const t = await getTranslations("CatalogPage");

	return (
		<MainContent className="layout-grid content-start">
			<section className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<h1 className="font-heading text-heading-2 font-strong text-balance text-text-strong">
					{t("title")}
				</h1>

				<p className="max-w-text text-pretty text-text-weak">{t("intro")}</p>

				<NuqsProvider>
					<CatalogView collectionName="work" />
				</NuqsProvider>
			</section>
		</MainContent>
	);
}
