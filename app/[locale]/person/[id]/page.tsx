import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { ExpressionOfWork } from "@/components/expression-of-work";
import { TBNavLink } from "@/components/tb-nav-link";
import { MainContent } from "@/components/ui/main-content";
import { getPerson } from "@/lib/data";
import type { IntlLocale } from "@/lib/i18n/locales";

interface PageProps {
	params: Promise<{ id: string; locale: IntlLocale }>;
}

function performanceYear(dateRange: string | null | undefined, dateRangeFrom: number): string {
	if (dateRange != null && dateRange !== "") {
		return dateRange;
	}

	const timestamp = dateRangeFrom < 10_000_000_000 ? dateRangeFrom * 1000 : dateRangeFrom;
	return String(new Date(timestamp).getUTCFullYear());
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
					{person.expressions && person.expressions.length > 0 ? (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{"Expressions"}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{person.expressions.map((expression) => {
									return (
										<li key={expression.id}>
											{expression.year != null ? `${String(expression.year)}: ` : null}
											{expression.work ? (
												<ExpressionOfWork
													expressionHref={`/expression/${expression.id}`}
													expressionTitle={expression.title}
													originalHref={`/work/${expression.work.id}`}
													originalTitle={expression.work.title}
												/>
											) : (
												<TBNavLink href={`/expression/${expression.id}`}>
													{expression.title} {"·"} {expression.language}
												</TBNavLink>
											)}
										</li>
									);
								})}
							</ul>
						</section>
					) : null}
					{person.performances && person.performances.length > 0 ? (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{"Performances"}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{person.performances.map((performance) => {
									return (
										<li key={performance.id}>
											<span className="mr-2 text-tiny">
												{performanceYear(performance.date_range, performance.date_range_from)}
											</span>
											<TBNavLink href={`/performance/${performance.id}`}>
												{performance.title}
											</TBNavLink>
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
