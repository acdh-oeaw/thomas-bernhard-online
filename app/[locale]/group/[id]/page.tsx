import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { TBNavLink } from "@/components/entity-links/tb-nav-link";
import { WorkLink } from "@/components/entity-links/work-link";
import { MainContent } from "@/components/ui/main-content";
import { getGroup } from "@/lib/data";
import type { IntlLocale } from "@/lib/i18n/locales";

interface PageProps {
	params: Promise<{ id: string; locale: IntlLocale }>;
}

export async function generateMetadata(
	props: Readonly<PageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { id } = await props.params;
	const group = await getGroup(id);

	return { title: group?.name ?? "Group" };
}

export default async function GroupPage(props: Readonly<PageProps>): Promise<ReactNode> {
	const { id, locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations("WorkPage");
	const tField = await getTranslations("Collection.field");
	let group: Awaited<ReturnType<typeof getGroup>> = null;

	try {
		group = await getGroup(id);
	} catch {
		notFound();
	}
	if (group == null) notFound();

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<header>
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{group.name}
					</h1>
				</header>

				<div className="grid max-w-text gap-y-8 text-small text-text-weak">
					{group.performances && group.performances.length > 0 ? (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{tField("performances")}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{group.performances.map((performance) => {
									return (
										<li key={performance.id}>
											{performance.date_range ? `${performance.date_range}: ` : null}
											<TBNavLink href={`/performance/${performance.id}`}>
												{performance.title}
											</TBNavLink>
											{performance.work ? (
												<>
													{" · "}
													<WorkLink work={performance.work} />
												</>
											) : null}
										</li>
									);
								})}
							</ul>
						</section>
					) : null}

					{group.sameas.length > 0 ? (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{tField("sameas")}
							</h2>
							<ul className="list-disc space-y-2 pl-5">
								{group.sameas.map((reference) => {
									return (
										<li key={reference} className="break-all">
											{reference}
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
						{JSON.stringify(group, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
