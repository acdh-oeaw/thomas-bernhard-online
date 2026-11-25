import { cn } from "@acdh-oeaw/style-variants";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { NavLink } from "@/components/nav-link";
import { Tag } from "@/components/ui/tag";
import { ValueList } from "@/components/ui/value-list";
import { entityBrandStyle, type SearchDisplayMode } from "@/config/ui";
import { itemCollections, type ItemType } from "@/lib/data";

export interface ResultCardField {
	label: string;
	labelSeparator?: string;
	values: ReadonlyArray<string>;
	more?: number;
	suffix?: string;
}

/** Select visible examples while keeping the full backend total for the remainder. */
export function resultCardValues(
	values: ReadonlyArray<string>,
	limit: number,
	totalCount = values.length,
): Pick<ResultCardField, "values" | "more"> {
	const visibleValues = values.slice(0, limit);
	const remaining = Math.max(totalCount - visibleValues.length, 0);
	return { values: visibleValues, more: remaining > 0 ? remaining : undefined };
}

function ResultCardValue(
	props: Readonly<Pick<ResultCardField, "values" | "more" | "suffix">>,
): ReactNode {
	const { values, more, suffix } = props;
	return (
		<>
			<ValueList more={more} values={values} />
			{suffix ? <span className="whitespace-nowrap text-text-weak"> {suffix}</span> : null}
		</>
	);
}

export interface ResultCardTag {
	label: string;
	value: string;
}

const emptyTags: ReadonlyArray<ResultCardTag> = [];

interface SearchResultCardProps {
	href: string;
	header: ReactNode;
	subheader?: ReactNode;
	summary?: ReactNode;
	metadata: ReadonlyArray<ResultCardField>;
	tags?: ReadonlyArray<ResultCardTag>;
	image: string;
	entityType: ItemType;
	displayMode: SearchDisplayMode;
}

export function SearchResultCard(props: Readonly<SearchResultCardProps>): ReactNode {
	const {
		metadata,
		tags = emptyTags,
		header,
		href,
		image,
		subheader,
		summary,
		entityType,
		displayMode,
	} = props;
	const isList = displayMode === "list";
	const fields = metadata.filter(({ values, more }) => {
		return values.length > 0 || (more != null && more > 0);
	});
	const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(image)}/180/280`;
	const t = useTranslations("ResultCard");

	return (
		<li className="min-w-0">
			<NavLink
				className="block h-full rounded-4 outline-transparent focus-visible:focus-outline"
				href={href}
			>
				<article
					className={cn(
						"interactive grid h-full gap-4 overflow-hidden rounded-4 border border-t-4 border-(--entity-brand-border) border-t-(--entity-brand-color) bg-(--entity-brand-tint) shadow-raised hover:hover-overlay",
						isList
							? "grid-cols-[minmax(0,1fr)_4rem] content-start p-4 sm:grid-cols-[minmax(0,1fr)_5rem]"
							: "min-h-72 grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)] p-6",
					)}
					data-display-mode={displayMode}
					style={entityBrandStyle(itemCollections[entityType])}
				>
					<div className="grid min-w-0 content-start gap-y-4">
						<header className="grid min-w-0 content-start gap-y-2">
							<p className="text-tiny font-strong tracking-wide text-(--entity-brand-color) uppercase">
								{t(entityType)}
							</p>
							<h2 className="line-clamp-2 min-w-0 font-heading text-heading-4 font-strong text-text-strong">
								{header}
							</h2>
							{subheader != null && subheader !== "" ? (
								<p className="text-small text-text-weak">{subheader}</p>
							) : null}
							{summary ? <p className="line-clamp-2 text-small text-text-weak">{summary}</p> : null}
						</header>
						{fields.length > 0 || (!isList && tags.length > 0) ? (
							<div
								className={cn(
									"min-w-0 text-small text-text-weak",
									!isList && "grid content-start gap-y-3",
								)}
							>
								{isList ? (
									<dl className="flex flex-wrap gap-x-4 gap-y-1">
										{fields.map(({ label, labelSeparator = ": ", values, more, suffix }) => {
											return (
												<div key={label} className="min-w-0 wrap-break-word">
													<dt className="inline font-strong">
														{label}
														{labelSeparator}
													</dt>
													<dd className="inline">
														<ResultCardValue more={more} suffix={suffix} values={values} />
													</dd>
												</div>
											);
										})}
									</dl>
								) : (
									<>
										{tags.length > 0 ? (
											<div
												aria-label={t("attributes")}
												className="flex flex-wrap gap-2"
												role="group"
											>
												{tags.map(({ label, value }) => {
													return (
														<Tag key={JSON.stringify([label, value])} label={label} value={value} />
													);
												})}
											</div>
										) : null}
										{fields.map(({ label, labelSeparator = ": ", values, more, suffix }) => {
											return (
												<div key={label} className="min-w-0 wrap-break-word">
													<span className="font-strong">
														{label}
														{labelSeparator}
													</span>
													<ResultCardValue more={more} suffix={suffix} values={values} />
												</div>
											);
										})}
									</>
								)}
							</div>
						) : null}
					</div>
					<div
						className={cn(
							"col-start-2 row-start-1",
							isList ? "flex items-start justify-end" : "relative min-h-0",
						)}
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							alt=""
							className={cn(
								"w-full object-contain",
								isList ? "max-h-24" : "absolute inset-0 h-full",
							)}
							src={imageUrl}
						/>
					</div>
				</article>
			</NavLink>
		</li>
	);
}
