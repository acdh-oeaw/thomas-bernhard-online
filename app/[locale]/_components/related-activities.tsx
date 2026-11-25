import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { GroupLink } from "@/components/entity-links/group-link";
import { TBNavLink } from "@/components/entity-links/tb-nav-link";
import { WorkLink } from "@/components/entity-links/work-link";
import type { EventWithRelations, PerformanceWithRelations } from "@/lib/data";
import { formatDateRange } from "@/lib/date-range";

/** Keep event and performance links and role labels distinct on related entity pages. */
export function RelatedActivities(
	props: Readonly<{
		performances?: ReadonlyArray<PerformanceWithRelations>;
		events?: ReadonlyArray<EventWithRelations>;
	}>,
): ReactNode {
	const t = useTranslations("ResultCard");
	const locale = useLocale();
	const { performances, events } = props;
	const sections = [
		{
			label: t("performances"),
			items: (performances ?? []).map((performance) => {
				return {
					...performance,
					href: `/performance/${performance.id}`,
					eventType: null,
					groups: performance.theaters ?? [],
					roles: [
						{ label: t("directors"), values: performance.directors ?? [] },
						{ label: t("actors"), values: performance.actors ?? [] },
					],
				};
			}),
		},
		{
			label: t("events"),
			items: (events ?? []).map((event) => {
				return {
					...event,
					href: `/event/${event.id}`,
					eventType: event.type_of_event,
					groups: event.location ? [event.location] : [],
					roles: [{ label: t("participants"), values: event.participant_ids ?? [] }],
				};
			}),
		},
	];

	return sections.map(({ label, items }) => {
		return items.length > 0 ? (
			<section key={label}>
				<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">{label}</h2>
				<ul className="list-disc space-y-2 pl-5 text-small text-text-weak">
					{items.map((item) => {
						const date = formatDateRange(item.date_range_from, item.date_range_to, locale);
						return (
							<li key={item.id}>
								<p>
									{date ? `${date}: ` : null}
									<TBNavLink href={item.href}>{item.title}</TBNavLink>
									{item.eventType ? ` · ${item.eventType}` : null}
									{item.work ? (
										<>
											{" · "}
											<WorkLink work={item.work} />
										</>
									) : null}
								</p>
								{item.groups.length > 0 ? (
									<p>
										{item.groups.map((group, index) => {
											return (
												<span key={group.id}>
													{index > 0 ? ", " : null}
													<GroupLink group={group} />
												</span>
											);
										})}
									</p>
								) : null}
								{item.roles.map(({ label, values }) => {
									const people = values.filter((person) => {
										return person.name;
									});
									return people.length > 0 ? (
										<p key={label}>
											{label}
											{": "}
											{people.map((person, index) => {
												return (
													<span key={person.id ?? index}>
														{index > 0 ? ", " : null}
														{person.id ? (
															<TBNavLink href={`/person/${person.id}`}>{person.name}</TBNavLink>
														) : (
															person.name
														)}
													</span>
												);
											})}
										</p>
									) : null;
								})}
							</li>
						);
					})}
				</ul>
			</section>
		) : null;
	});
}
