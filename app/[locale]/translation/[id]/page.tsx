import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { RelatedActivities } from "@/app/[locale]/_components/related-activities";
import { WorkBreadcrumb } from "@/components/entity-breadcrumbs";
import { TBNavLink } from "@/components/entity-links/tb-nav-link";
import { LanguageLabel } from "@/components/language-label";
import { MainContent } from "@/components/ui/main-content";
import { getTranslation } from "@/lib/data";
import { formatDateRange } from "@/lib/date-range";
import type { IntlLocale } from "@/lib/i18n/locales";

interface PageProps {
	params: Promise<{ id: string; locale: IntlLocale }>;
}

export async function generateMetadata(
	props: Readonly<PageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { id } = await props.params;
	const translation = await getTranslation(id);

	return { title: translation?.title ?? "Translation" };
}

export default async function TranslationPage(props: Readonly<PageProps>): Promise<ReactNode> {
	const { id, locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations("WorkPage");
	let translation: Awaited<ReturnType<typeof getTranslation>> = null;

	try {
		translation = await getTranslation(id);
	} catch {
		notFound();
	}
	if (translation == null) notFound();

	const translatorNames =
		translation.authors
			?.map((author) => {
				return author.name;
			})
			.filter((name): name is string => {
				return Boolean(name);
			}) ?? [];

	const translationBreadcrumbLabel = (
		<>
			{translation.title} {"("}
			<LanguageLabel code={translation.language} />
			{translatorNames.length > 0 ? `, tr. ${translatorNames.join(", ")}` : null}
			{")"}
		</>
	);

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<WorkBreadcrumb items={[{ label: translationBreadcrumbLabel }]} work={translation.work} />
				<header className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{translation.title}
					</h1>
					<p className="font-heading text-heading-4 text-text-weak">
						{translation.year != null ? (
							<>
								{translation.year}
								{": "}
							</>
						) : null}
						<LanguageLabel code={translation.language} /> {"·"} {translation.type}
					</p>
				</header>

				<div className="grid max-w-text gap-y-6 text-small text-text-weak">
					{translation.authors && translation.authors.length > 0 ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{"Translators"}
							</h2>
							<p>
								{translation.authors.map((author, index) => {
									return (
										<span key={author.id}>
											{index > 0 ? ", " : null}
											<TBNavLink href={`/person/${author.id}`}>{author.name}</TBNavLink>
										</span>
									);
								})}
							</p>
						</section>
					) : null}
					{translation.manifestations?.length ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{"Published in"}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{translation.manifestations.map((publication) => {
									const date = formatDateRange(
										publication.publication_date_from,
										publication.publication_date_to,
										locale,
										{ year: "numeric" },
									);
									return (
										<li key={publication.id}>
											<TBNavLink href={`/publication/${publication.id}`}>
												{publication.title}
											</TBNavLink>
											{date ? ` (${date})` : null}
										</li>
									);
								})}
							</ul>
						</section>
					) : null}
					<RelatedActivities
						events={translation.work?.events}
						performances={translation.work?.performances}
					/>
				</div>

				<details className="mt-4">
					<summary className="interactive w-fit cursor-pointer rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong select-none hover:hover-overlay focus-visible:focus-outline">
						{t("raw-data")}
					</summary>
					<pre className="mt-2 overflow-x-auto rounded-2 border border-stroke-weak bg-background-raised p-4 font-code text-tiny text-text-weak">
						{JSON.stringify(translation, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
