import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { TBNavLink } from "@/components/entity-links/tb-nav-link";
import { TranslationOfWork } from "@/components/translation-of-work";
import { MainContent } from "@/components/ui/main-content";
import { getPerson } from "@/lib/data";
import type { IntlLocale } from "@/lib/i18n/locales";

interface PageProps {
	params: Promise<{ id: string; locale: IntlLocale }>;
}

export async function generateMetadata(
	props: Readonly<PageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { id } = await props.params;
	const person = await getPerson(id);

	return { title: person?.name ?? "Person" };
}

export default async function PersonPage(props: Readonly<PageProps>): Promise<ReactNode> {
	const { id, locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations("WorkPage");
	let person: Awaited<ReturnType<typeof getPerson>> = null;

	try {
		person = await getPerson(id);
	} catch {
		notFound();
	}
	if (person == null) notFound();

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<header>
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{person.name}
					</h1>
				</header>

				<div className="grid max-w-text gap-y-8 text-small text-text-weak">
					{person.translations && person.translations.length > 0 ? (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{"Translations"}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{person.translations.map((translation) => {
									return (
										<li key={translation.id}>
											{translation.year != null ? `${String(translation.year)}: ` : null}
											{translation.work ? (
												<TranslationOfWork
													originalHref={`/work/${translation.work.id}`}
													originalTitle={translation.work.title}
													translationHref={`/translation/${translation.id}`}
													translationTitle={translation.title}
												/>
											) : (
												<TBNavLink href={`/translation/${translation.id}`}>
													{translation.title} {"·"} {translation.language}
												</TBNavLink>
											)}
										</li>
									);
								})}
							</ul>
						</section>
					) : null}
				</div>

				<details className="mt-4">
					<summary className="interactive w-fit cursor-pointer rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong select-none hover:hover-overlay focus-visible:focus-outline">
						{t("raw-data")}
					</summary>
					<pre className="mt-2 overflow-x-auto rounded-2 border border-stroke-weak bg-background-raised p-4 font-code text-tiny text-text-weak">
						{JSON.stringify(person, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
