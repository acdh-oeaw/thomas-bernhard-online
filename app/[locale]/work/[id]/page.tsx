import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { LanguageLabel } from "@/components/language-label";
import { TBNavLink } from "@/components/tb-nav-link";
import { MainContent } from "@/components/ui/main-content";
import { getWork, getWorkWithRelations } from "@/lib/data";
import type { IntlLocale } from "@/lib/i18n/locales";

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
			id: string;
			name: string;
		}>;
		path?: string;
	}>,
): ReactNode {
	const { values, path } = props;

	if (values.length === 0) {
		return null;
	}

	return values.map((value, index) => {
		const name = path ? (
			<TBNavLink href={`${path}/${value.id}`}>{value.name}</TBNavLink>
		) : (
			value.name
		);

		return (
			<span key={value.id}>
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
	const { id } = await params;

	const t = await getTranslations("WorkPage");
	try {
		const document = await getWork(id);

		return {
			title: document?.title ?? t("default-title"),
		};
	} catch {
		return {
			title: t("default-title"),
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

	const { title, category, authors, performances, expressions, sameas, year } = document;

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
					{authors && authors.length > 0 ? (
						<MetadataSection title={tField("authors")}>
							{authors.map((author) => {
								return (
									<li key={author.id} className="text-small text-text-weak">
										<TBNavLink href={`/person/${author.id}`}>{author.name}</TBNavLink>
									</li>
								);
							})}
						</MetadataSection>
					) : null}

					{performances && performances.length > 0 ? (
						<MetadataSection title={tField("performances")}>
							{performances.map((performance) => {
								const theaters = performance.theaters ?? [];
								const actors = performance.actors ?? [];
								const directors = performance.directors ?? [];

								return (
									<li key={performance.id} className="text-small text-text-weak">
										{performance.date_range ? (
											<>
												{performance.date_range}
												{": "}
											</>
										) : null}
										<TBNavLink href={`/performance/${performance.id}`}>
											{performance.title}
										</TBNavLink>
										{theaters.length > 0 ? (
											<>
												{" at "}
												<RelatedEntities path="/group" values={theaters} />
											</>
										) : null}
										{actors.length > 0 ? (
											<>
												{" (actors: "}
												<RelatedEntities path="/person" values={actors} />
												{")"}
											</>
										) : null}
										{directors.length > 0 ? (
											<>
												{" (directors: "}
												<RelatedEntities path="/person" values={directors} />
												{")"}
											</>
										) : null}
									</li>
								);
							})}
						</MetadataSection>
					) : null}

					{expressions && expressions.length > 0 ? (
						<MetadataSection title={tField("expressions")}>
							{expressions.map((expression) => {
								const translators = expression.translators ?? [];

								return (
									<li key={expression.id} className="text-small text-text-weak">
										{expression.year != null ? (
											<>
												{expression.year}
												{": "}
											</>
										) : null}
										<TBNavLink href={`/expression/${expression.id}`}>{expression.title}</TBNavLink>{" "}
										<span className="text-tiny">
											(<LanguageLabel code={expression.language} />
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
