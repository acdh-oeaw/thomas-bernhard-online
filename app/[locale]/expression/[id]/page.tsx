import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { LanguageLabel } from "@/components/language-label";
import { TBNavLink } from "@/components/tb-nav-link";
import { MainContent } from "@/components/ui/main-content";
import { getExpression } from "@/lib/data";
import type { IntlLocale } from "@/lib/i18n/locales";

interface PageProps {
	params: Promise<{ id: string; locale: IntlLocale }>;
}

function Names(props: Readonly<{ values: ReadonlyArray<{ name?: string | null }> }>): ReactNode {
	const { values } = props;

	if (values.length === 0) {
		return null;
	}

	return values
		.map((value) => {
			return value.name;
		})
		.filter(Boolean)
		.join(", ");
}

export async function generateMetadata(
	props: Readonly<PageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { id } = await props.params;
	const expression = await getExpression(id);

	return { title: expression?.title ?? "Expression" };
}

export default async function ExpressionPage(props: Readonly<PageProps>): Promise<ReactNode> {
	const { id, locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations("WorkPage");
	let expression: Awaited<ReturnType<typeof getExpression>> = null;

	try {
		expression = await getExpression(id);
	} catch {
		notFound();
	}
	if (expression == null) notFound();

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<header className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{expression.title}
					</h1>
					<p className="font-heading text-heading-4 text-text-weak">
						{expression.year != null ? (
							<>
								{expression.year}
								{": "}
							</>
						) : null}
						<LanguageLabel code={expression.language} /> {"·"} {expression.type}
					</p>
				</header>

				<div className="grid max-w-text gap-y-6 text-small text-text-weak">
					{expression.work ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{"Work"}
							</h2>
							<p>
								<TBNavLink href={`/work/${expression.work.id}`}>{expression.work.title}</TBNavLink>
							</p>
						</section>
					) : null}
					{expression.authors && expression.authors.length > 0 ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{"Translators"}
							</h2>
							<p>
								{expression.authors.map((author, index) => {
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
					{expression.work?.performances && expression.work.performances.length > 0 ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{"Performances"}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{expression.work.performances.map((performance) => {
									return (
										<li key={performance.id}>
											<p>
												{performance.date_range ? `${performance.date_range}: ` : null}
												<TBNavLink href={`/performance/${performance.id}`}>
													{performance.title}
												</TBNavLink>
												{" · "}
												{performance.type}
											</p>
											{performance.directors?.length ? (
												<p>
													{"Directors: "}
													<Names values={performance.directors} />
												</p>
											) : null}
											{performance.actors?.length ? (
												<p>
													{"Actors: "}
													<Names values={performance.actors} />
												</p>
											) : null}
											{performance.theaters?.length ? (
												<p>
													{"Theaters: "}
													<Names values={performance.theaters} />
												</p>
											) : null}
											{performance.posters?.length ? (
												<p>
													{"Posters: "}
													<Names values={performance.posters} />
												</p>
											) : null}
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
						{JSON.stringify(expression, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
