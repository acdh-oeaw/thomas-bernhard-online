import { createUrl, createUrlSearchParams, request } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { MainContent } from "#/components/ui/main-content.tsx";
import { env } from "#/config/env.config.ts";
import { getAlternates } from "#/lib/i18n/alternates.ts";
import type { IntlLocale } from "#/lib/i18n/locales.ts";
import { isHttpError } from "#/lib/server/errors.ts";

interface ImprintPageProps {
	params: Promise<{
		locale: IntlLocale;
	}>;
}

export async function generateMetadata(
	props: Readonly<ImprintPageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { params } = props;

	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "ImprintPage" });

	const metadata: Metadata = {
		title: t("meta.title"),
		alternates: getAlternates(locale, "/imprint"),
	};

	return metadata;
}

export default async function ImprintPage(props: Readonly<ImprintPageProps>): Promise<ReactNode> {
	const { params } = props;

	const { locale } = await params;

	setRequestLocale(locale);

	const t = await getTranslations("ImprintPage");

	const html = await getImprintHtml(locale);

	return (
		<MainContent className="layout-grid content-start">
			<section className="relative layout-subgrid grid gap-y-6 bg-fill-weaker py-16 xs:py-20">
				<div className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-heading-1 font-strong text-balance text-text-strong">
						{t("title")}
					</h1>
				</div>
			</section>

			<section
				// oxlint-disable-next-line react/no-danger
				dangerouslySetInnerHTML={{ __html: html }}
				className="relative layout-subgrid typography content-max-w-text border-t border-stroke-weak py-16 xs:py-20"
			/>
		</MainContent>
	);
}

function createImprintUrl(locale: IntlLocale): URL {
	return createUrl({
		baseUrl: env.NEXT_PUBLIC_IMPRINT_SERVICE_BASE_URL,
		pathname: `/${String(env.NEXT_PUBLIC_REDMINE_ID)}`,
		searchParams: createUrlSearchParams({ locale }),
	});
}

async function getImprintHtml(locale: IntlLocale): Promise<string> {
	try {
		const url = createImprintUrl(locale);
		const html = await request(url, { responseType: "text" });

		return html;
	} catch (error) {
		if (isHttpError(error) && error.response.status === 404) {
			notFound();
		}

		throw error;
	}
}
