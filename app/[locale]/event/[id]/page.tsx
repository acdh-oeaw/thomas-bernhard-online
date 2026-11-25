import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkBreadcrumb } from "@/components/entity-breadcrumbs";
import { GroupLink } from "@/components/entity-links/group-link";
import { TBNavLink } from "@/components/entity-links/tb-nav-link";
import { WorkLink } from "@/components/entity-links/work-link";
import { MainContent } from "@/components/ui/main-content";
import { getEvent } from "@/lib/data";
import type { IntlLocale } from "@/lib/i18n/locales";

interface PageProps {
	params: Promise<{ id: string; locale: IntlLocale }>;
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
	const event = await getEvent(id);

	return { title: event?.title ?? "Event" };
}

export default async function EventPage(props: Readonly<PageProps>): Promise<ReactNode> {
	const { id, locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations("WorkPage");
	const tCard = await getTranslations("ResultCard");
	let event: Awaited<ReturnType<typeof getEvent>> = null;

	try {
		event = await getEvent(id);
	} catch {
		notFound();
	}
	if (event == null) notFound();

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<WorkBreadcrumb items={[{ label: event.title }]} work={event.work} />
				<header className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{event.title}
					</h1>
					<p className="font-heading text-heading-4 text-text-weak">{event.type_of_event}</p>
				</header>

				<div className="grid max-w-text gap-y-6 text-small text-text-weak">
					{event.work ? (
						<section>
							<h2 className="mb-2 font-heading text-heading-4 font-strong text-text-strong">
								{tCard("original-work")}
							</h2>
							<p>
								<WorkLink work={event.work} />
							</p>
						</section>
					) : null}
					{event.date_range ? <p>{event.date_range}</p> : null}
					{event.participant_ids?.length ? (
						<p>
							{tCard("participants")}
							{": "}
							<People values={event.participant_ids} />
						</p>
					) : null}
					{event.location ? (
						<p>
							{tCard("location")}
							{": "}
							<GroupLink group={event.location} />
						</p>
					) : null}
				</div>

				<details className="mt-4">
					<summary className="interactive w-fit cursor-pointer rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong select-none hover:hover-overlay focus-visible:focus-outline">
						{t("raw-data")}
					</summary>
					<pre className="mt-2 overflow-x-auto rounded-2 border border-stroke-weak bg-background-raised p-4 font-code text-tiny text-text-weak">
						{JSON.stringify(event, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
