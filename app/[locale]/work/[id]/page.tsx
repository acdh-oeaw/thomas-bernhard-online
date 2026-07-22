import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { MainContent } from "@/components/ui/main-content";
import { env } from "@/config/env.config";
import type { IntlLocale } from "@/lib/i18n/locales";
import type { tbo_workCollection } from "@/lib/typesense/collections";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import type { CollectionDocument } from "@/lib/typesense/schema";

type WorkDocument = CollectionDocument<typeof tbo_workCollection>;

interface WorkPageProps {
	params: Promise<{
		id: string;
		locale: IntlLocale;
	}>;
}

export async function generateMetadata(
	props: Readonly<WorkPageProps>,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const { params } = props;
	const { id } = await params;

	const t = await getTranslations("WorkPage");
	const client = createTypesenseClient();
	const collectionName = env.NEXT_PUBLIC_TYPESENSE_COLLECTION;

	try {
		const document = await client
			.collections<WorkDocument>(collectionName)
			.documents(id)
			.retrieve();

		return {
			title:
				(typeof document.title === "string" ? document.title : undefined) ?? t("default-title"),
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
	const client = createTypesenseClient();
	const collectionName = env.NEXT_PUBLIC_TYPESENSE_COLLECTION;

	let document: WorkDocument | null = null;

	try {
		document = await client.collections<WorkDocument>(collectionName).documents(id).retrieve();
	} catch {
		notFound();
	}

	const authors = Array.isArray(document.authors) ? document.authors : null;
	const performances = Array.isArray(document.performances) ? document.performances : null;
	const expressions = Array.isArray(document.expressions) ? document.expressions : null;
	const references = Array.isArray(document.sameas) ? document.sameas : null;

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<header className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{(typeof document.title === "string" ? document.title : undefined) ?? t("untitled")}
					</h1>
					{typeof document.category === "string" && document.category && (
						<p className="font-heading text-heading-4 text-text-weak">{document.category}</p>
					)}
				</header>

				<div className="grid max-w-text gap-y-6">
					{authors && authors.length > 0 && (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{t("authors")}
							</h2>
							<ul className="space-y-2">
								{authors.map((author: Record<string, unknown>, idx: number) => {
									return (
										<li key={idx} className="text-small text-text-weak">
											{(author.name as string) || t("unknown")}
										</li>
									);
								})}
							</ul>
						</section>
					)}

					{performances && performances.length > 0 && (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{t("performances")}
							</h2>
							<ul className="space-y-2">
								{performances.map((perf: Record<string, unknown>, idx: number) => {
									return (
										<li key={idx} className="text-small text-text-weak">
											{(perf.label as string) || t("unknown")}
										</li>
									);
								})}
							</ul>
						</section>
					)}

					{expressions && expressions.length > 0 && (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{t("expressions")}
							</h2>
							<ul className="space-y-2">
								{expressions.map((expr: Record<string, unknown>, idx: number) => {
									return (
										<li key={idx} className="text-small text-text-weak">
											{(expr.title as string) || (expr.language as string) || t("unknown")}
										</li>
									);
								})}
							</ul>
						</section>
					)}

					{references && references.length > 0 && (
						<section>
							<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">
								{t("references")}
							</h2>
							<ul className="space-y-2">
								{references.map((ref: string, idx: number) => {
									return (
										<li key={idx} className="text-small break-all text-text-weak">
											{ref}
										</li>
									);
								})}
							</ul>
						</section>
					)}
				</div>
			</article>
		</MainContent>
	);
}
