import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { TBNavLink } from "@/components/tb-nav-link";
import { MainContent } from "@/components/ui/main-content";
import { getPerformance } from "@/lib/data";
import type { IntlLocale } from "@/lib/i18n/locales";

interface PageProps {
	params: Promise<{ id: string; locale: IntlLocale }>;
}

function Names(props: Readonly<{ values: ReadonlyArray<{ name: string }> }>): ReactNode {
	const { values } = props;

	if (values.length === 0) {
		return null;
	}

	return values
		.map((value) => {
			return value.name;
		})
		.join(", ");
}

function People(
	props: Readonly<{ values: ReadonlyArray<{ id?: string | null; name?: string | null }> }>,
): ReactNode {
	const { values } = props;

	return values
		.map((value) => {
			if (value.name == null || value.name === "") {
				return null;
			}

			return value.id ? (
				<TBNavLink href={`/person/${value.id}`}>{value.name}</TBNavLink>
			) : (
				value.name
			);
		})
		.filter(Boolean)
		.reduce<Array<ReactNode>>((result, value) => {
			if (result.length > 0) {
				result.push(", ");
			}
			result.push(value);
			return result;
		}, []);
}

export async function generateMetadata(
	props: Readonly<PageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { id } = await props.params;
	const performance = await getPerformance(id);

	return { title: performance?.title ?? "Performance" };
}

export default async function PerformancePage(props: Readonly<PageProps>): Promise<ReactNode> {
	const { id, locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations("WorkPage");
	let performance: Awaited<ReturnType<typeof getPerformance>> = null;

	try {
		performance = await getPerformance(id);
	} catch {
		notFound();
	}
	if (performance == null) notFound();

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<header className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{performance.title}
					</h1>
					<p className="font-heading text-heading-4 text-text-weak">{performance.type}</p>
				</header>

				<div className="grid max-w-text gap-y-6 text-small text-text-weak">
					{performance.work ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{"Work"}
							</h2>
							<p>
								<TBNavLink href={`/work/${performance.work.id}`}>
									{performance.work.title}
								</TBNavLink>
							</p>
						</section>
					) : null}
					{performance.date_range ? <p>{performance.date_range}</p> : null}
					{performance.directors && performance.directors.length > 0 ? (
						<p>
							{"Directors: "}
							<People values={performance.directors} />
						</p>
					) : null}
					{performance.actors && performance.actors.length > 0 ? (
						<p>
							{"Actors: "}
							<People values={performance.actors} />
						</p>
					) : null}
					{performance.people && performance.people.length > 0 ? (
						<p>
							{"Participants: "}
							{performance.people.map((person, index) => {
								return (
									<span key={person.id}>
										{index > 0 ? ", " : null}
										<TBNavLink href={`/person/${person.id}`}>{person.name}</TBNavLink>
									</span>
								);
							})}
						</p>
					) : null}
					{performance.posters && performance.posters.length > 0 ? (
						<p>
							{"Posters: "}
							<Names values={performance.posters} />
						</p>
					) : null}
					{performance.theaters && performance.theaters.length > 0 ? (
						<p>
							{"Theaters: "}
							<Names values={performance.theaters} />
						</p>
					) : null}
				</div>

				<details className="mt-4">
					<summary className="interactive w-fit cursor-pointer rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong select-none hover:hover-overlay focus-visible:focus-outline">
						{t("raw-data")}
					</summary>
					<pre className="mt-2 overflow-x-auto rounded-2 border border-stroke-weak bg-background-raised p-4 font-code text-tiny text-text-weak">
						{JSON.stringify(performance, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
