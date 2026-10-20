import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { EntityBreadcrumbs } from "@/components/entity-breadcrumbs";
import { TBNavLink } from "@/components/entity-links/tb-nav-link";
import { LanguageLabel } from "@/components/language-label";
import { MainContent } from "@/components/ui/main-content";
import { getManifestation, getSourceForEntityType } from "@/lib/data";
import type { IntlLocale } from "@/lib/i18n/locales";
import { publicationDateRange } from "@/lib/publication-date";

interface PageProps {
	params: Promise<{ id: string; locale: IntlLocale }>;
}

export async function generateMetadata(props: Readonly<PageProps>): Promise<Metadata> {
	const { id } = await props.params;
	const publication = await getManifestation(id);
	return { title: publication?.title };
}

export default async function PublicationPage(props: Readonly<PageProps>): Promise<ReactNode> {
	const { id, locale } = await props.params;
	setRequestLocale(locale);
	const t = await getTranslations("PublicationPage");
	const tWork = await getTranslations("WorkPage");
	const publication = await getManifestation(id);
	if (publication == null) notFound();

	const fields = [
		[t("other-title-information"), publication.other_title_information],
		[t("isbn"), publication.isbn],
		[t("relevant-pages"), publication.relevant_pages],
		[t("shelfmark"), publication.tbit_shelfmark],
	] as const;

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<EntityBreadcrumbs
					items={[{ label: publication.title }]}
					source={getSourceForEntityType("manifestation")}
				/>
				<header className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{publication.title}
					</h1>
					{publication.subtitle ? (
						<p className="font-heading text-heading-4 text-text-weak">{publication.subtitle}</p>
					) : null}
					<p className="font-heading text-heading-4 text-text-weak">
						{publicationDateRange(publication)} {"· "}
						<LanguageLabel code={publication.language} /> {"· "}
						{t("publication")}
					</p>
				</header>
				<div className="grid max-w-text gap-y-6 text-small text-text-weak">
					{publication.expressions?.length ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{t("translations")}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{publication.expressions.map((expression) => {
									return (
										<li key={expression.id}>
											<TBNavLink href={`/expression/${expression.id}`}>
												{expression.title}
											</TBNavLink>
											{" · "}
											<LanguageLabel code={expression.language} />
											{expression.year != null ? ` (${String(expression.year)})` : null}
										</li>
									);
								})}
							</ul>
						</section>
					) : null}
					<dl className="grid gap-y-4">
						{fields.map(([label, value]) => {
							return value != null && value !== "" ? (
								<div key={label}>
									<dt className="font-strong text-text-strong">{label}</dt>
									<dd>{value}</dd>
								</div>
							) : null;
						})}
					</dl>
					{publication.publisher?.length ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{t("publishers")}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{publication.publisher.map((publisher, index) => {
									return (
										<li key={publisher.id ?? index}>
											{publisher.id ? (
												<TBNavLink href={`/group/${publisher.id}`}>
													{publisher.name ?? publisher.id}
												</TBNavLink>
											) : (
												publisher.name
											)}
										</li>
									);
								})}
							</ul>
						</section>
					) : null}
					{publication.sameas.length > 0 ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{t("identifiers")}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{publication.sameas.map((identifier) => {
									return <li key={identifier}>{identifier}</li>;
								})}
							</ul>
						</section>
					) : null}
				</div>
				<details className="mt-4">
					<summary className="interactive w-fit cursor-pointer rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong select-none hover:hover-overlay focus-visible:focus-outline">
						{tWork("raw-data")}
					</summary>
					<pre className="mt-2 overflow-x-auto rounded-2 border border-stroke-weak bg-background-raised p-4 font-code text-tiny text-text-weak">
						{JSON.stringify(publication, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
