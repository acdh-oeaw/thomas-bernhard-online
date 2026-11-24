import { cn } from "@acdh-oeaw/style-variants";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { NavLink } from "@/components/nav-link";
import { entityBrandStyle, type SearchDisplayMode } from "@/config/ui";
import { itemCollections, type ItemType } from "@/lib/data";

export interface ResultCardField {
	label: string;
	value: ReactNode;
	/** Only short, discrete attributes become tags in card mode. */
	isTag?: boolean;
}

interface SearchResultCardProps {
	href: string;
	header: ReactNode;
	subheader?: ReactNode;
	summary?: ReactNode;
	metadata: ReadonlyArray<ResultCardField>;
	image: string;
	entityType: ItemType;
	displayMode: SearchDisplayMode;
}

export function SearchResultCard(props: Readonly<SearchResultCardProps>): ReactNode {
	const { metadata, header, href, image, subheader, summary, entityType, displayMode } = props;
	const isList = displayMode === "list";
	const fields = metadata.filter(({ value }) => {
		return value != null && value !== "" && value !== false;
	});
	const tags = fields
		.filter((field) => {
			return field.isTag;
		})
		.slice(0, 3);
	const descriptions = fields.filter((field) => {
		return !field.isTag;
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
						{fields.length > 0 ? (
							<div
								className={cn(
									"min-w-0 text-small text-text-weak",
									!isList && "grid content-start gap-y-3",
								)}
							>
								{isList ? (
									<dl className="flex flex-wrap gap-x-4 gap-y-1">
										{fields.map(({ label, value }) => {
											return (
												<div key={label} className="min-w-0 wrap-break-word">
													<dt className="inline font-strong">
														{label}
														{": "}
													</dt>
													<dd className="inline">{value}</dd>
												</div>
											);
										})}
									</dl>
								) : (
									<>
										{tags.length > 0 ? (
											<ul aria-label={t("attributes")} className="flex flex-wrap gap-2" role="list">
												{tags.map(({ label, value }) => {
													return (
														<li
															key={label}
															className="rounded-full border border-(--entity-brand-border) bg-(--entity-brand-tint) px-2 py-0.5 text-tiny"
														>
															<span className="sr-only">
																{label}
																{": "}
															</span>
															{value}
														</li>
													);
												})}
											</ul>
										) : null}
										{descriptions.map(({ label, value }) => {
											return (
												<p key={label} className="min-w-0 wrap-break-word">
													<span className="font-strong">
														{label}
														{": "}
													</span>
													{value}
												</p>
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
