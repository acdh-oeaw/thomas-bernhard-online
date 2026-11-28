import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { RelatedActivities } from "#/app/[locale]/_components/related-activities.tsx";
import { TBNavLink } from "#/components/entity-links/tb-nav-link.tsx";
import { LanguageLabel } from "#/components/language-label.tsx";
import { MainContent } from "#/components/ui/main-content.tsx";
import { getWork, getWorkWithRelations } from "#/lib/data.ts";
import { getAlternates } from "#/lib/i18n/alternates.ts";
import type { IntlLocale } from "#/lib/i18n/locales.ts";

interface WorkPageProps {
	params: Promise<{
		id: string;
		locale: IntlLocale;
	}>;
}

function MetadataSection(props: Readonly<{ title: string; children: ReactNode }>): ReactNode {
	const { title, children } = props;

	return (
		<section>
			<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">{title}</h2>
			<ul className="list-disc space-y-2 pl-5">{children}</ul>
		</section>
	);
}

function RelatedEntities(
	props: Readonly<{
		values: ReadonlyArray<{
			id?: string | null;
			name?: string | null;
		}>;
		path?: string;
	}>,
): ReactNode {
	const { values, path } = props;

	if (values.length === 0) {
		return null;
	}

	return values.map((value, index) => {
		const name =
			path && value.id ? (
				<TBNavLink href={`${path}/${value.id}`}>{value.name}</TBNavLink>
			) : (
				value.name
			);

		return (
			<span key={value.id ?? index}>
				{index > 0 ? ", " : null}
				{name}
			</span>
		);
	});
}

export async function generateMetadata(
	props: Readonly<WorkPageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { params } = props;
	const { id, locale } = await params;

	const t = await getTranslations("WorkPage");
	const alternates = getAlternates(locale, `/work/${id}`);
	try {
		const document = await getWork(id);

		return {
			title: document?.title ?? t("default-title"),
			alternates,
		};
	} catch {
		return {
			title: t("default-title"),
			alternates,
		};
	}
}

export default async function WorkPage(props: Readonly<WorkPageProps>): Promise<ReactNode> {
	const { params } = props;
	const { id, locale } = await params;

	setRequestLocale(locale);

	const t = await getTranslations("WorkPage");
	// Reusable, collection-specific field labels.
	const tField = await getTranslations("Collection.field");
	let document: Awaited<ReturnType<typeof getWorkWithRelations>> = null;

	try {
		document = await getWorkWithRelations(id);
	} catch {
		notFound();
	}
	if (document == null) notFound();

	const { title, category, performances, translations, sameas, year } = document;

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<header className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{title || t("untitled")}
					</h1>
					{year != null ? (
						<p className="font-heading text-heading-4 text-text-weak">{year}</p>
					) : null}
					{category ? (
						<p className="font-heading text-heading-4 text-text-weak">{category}</p>
					) : null}
				</header>

				<div className="grid max-w-text gap-y-8">
					<RelatedActivities events={document.events} performances={performances} />

					{translations && translations.length > 0 ? (
						<MetadataSection title={tField("translations")}>
							{translations.map((translation) => {
								const translators = translation.translators ?? [];

								return (
									<li key={translation.id} className="text-small text-text-weak">
										{translation.year != null ? (
											<>
												{translation.year}
												{": "}
											</>
										) : null}
										<TBNavLink href={`/translation/${translation.id}`}>
											{translation.title}
										</TBNavLink>{" "}
										<span className="text-tiny">
											(<LanguageLabel code={translation.language} />
											{translators.length > 0 && (
												<>
													{", translated by "}
													<RelatedEntities path="/person" values={translators} />
												</>
											)}
											)
										</span>
									</li>
								);
							})}
						</MetadataSection>
					) : null}

					{sameas.length > 0 ? (
						<MetadataSection title={tField("sameas")}>
							{sameas.map((reference) => {
								return (
									<li key={reference} className="text-small break-all text-text-weak">
										{reference}
									</li>
								);
							})}
						</MetadataSection>
					) : null}
				</div>

				<details className="mt-4">
					<summary className="interactive w-fit cursor-pointer rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong select-none hover:hover-overlay focus-visible:focus-outline">
						{t("raw-data")}
					</summary>
					<pre className="mt-2 overflow-x-auto rounded-2 border border-stroke-weak bg-background-raised p-4 font-code text-tiny text-text-weak">
						{JSON.stringify(document, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
