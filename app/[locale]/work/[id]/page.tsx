import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { LanguageLabel } from "@/components/language-label";
import { MainContent } from "@/components/ui/main-content";
import { env } from "@/config/env.config";
import type { IntlLocale } from "@/lib/i18n/locales";
import type { collections } from "@/lib/typesense/collections";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import type { CollectionDocument } from "@/lib/typesense/schema";

type WorkDocument = CollectionDocument<typeof collections.tbo_work.collection>;

interface WorkPageProps {
	params: Promise<{
		id: string;
		locale: IntlLocale;
	}>;
}

function MetadataSection(props: Readonly<{ title: string; children: ReactNode }>): ReactNode {
	const { title, children } = props;

	return (
		<section>
			<h2 className="mb-4 font-heading text-heading-4 font-strong text-text-strong">{title}</h2>
			<ul className="list-disc space-y-2 pl-5">{children}</ul>
		</section>
	);
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
			title: document.title || t("default-title"),
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
	// Reusable, collection-specific field labels.
	const tField = await getTranslations("Collection.field");
	const client = createTypesenseClient();
	const collectionName = env.NEXT_PUBLIC_TYPESENSE_COLLECTION;

	let document: WorkDocument | null = null;

	try {
		document = await client.collections<WorkDocument>(collectionName).documents(id).retrieve();
	} catch {
		notFound();
	}

	const { title, category, authors, performances, expressions, sameas } = document;

	return (
		<MainContent className="layout-grid content-start">
			<article className="relative layout-subgrid gap-y-8 py-16 xs:py-24">
				<header className="grid max-w-text gap-y-4">
					<h1 className="font-heading text-display font-strong text-balance text-text-strong">
						{title || t("untitled")}
					</h1>
					{category ? (
						<p className="font-heading text-heading-4 text-text-weak">{category}</p>
					) : null}
				</header>

				<div className="grid max-w-text gap-y-6">
					{authors && authors.length > 0 ? (
						<MetadataSection title={tField("authors")}>
							{authors.map((author, index) => {
								return (
									<li key={author.id ?? index} className="text-small text-text-weak">
										{author.name ?? t("unknown")}
									</li>
								);
							})}
						</MetadataSection>
					) : null}

					{performances && performances.length > 0 ? (
						<MetadataSection title={tField("performances")}>
							{performances.map((performance, index) => {
								return (
									<li key={performance.id ?? index} className="text-small text-text-weak">
										{performance.label ?? t("unknown")}
									</li>
								);
							})}
						</MetadataSection>
					) : null}

					{expressions && expressions.length > 0 ? (
						<MetadataSection title={tField("expressions")}>
							{expressions.map((expression, index) => {
								return (
									<li key={expression.id ?? index} className="text-small text-text-weak">
										{expression.title != null ? (
											<>
												{expression.title}
												{expression.language != null ? (
													<span className="ml-2 text-tiny text-text-weak">
														<LanguageLabel code={expression.language} />
													</span>
												) : null}
											</>
										) : expression.language != null ? (
											<LanguageLabel code={expression.language} />
										) : (
											t("unknown")
										)}
									</li>
								);
							})}
						</MetadataSection>
					) : null}

					{sameas.length > 0 ? (
						<MetadataSection title={tField("sameas")}>
							{sameas.map((reference) => {
								return (
									<li key={reference} className="text-small break-all text-text-weak">
										{reference}
									</li>
								);
							})}
						</MetadataSection>
					) : null}
				</div>

				<details className="mt-4">
					<summary className="interactive w-fit cursor-pointer rounded-2 border border-stroke-weak bg-background-raised px-3 py-2 text-small text-text-strong select-none hover:hover-overlay focus-visible:focus-outline">
						{t("raw-data")}
					</summary>
					<pre className="mt-2 overflow-x-auto rounded-2 border border-stroke-weak bg-background-raised p-4 font-code text-tiny text-text-weak">
						{JSON.stringify(document, null, 2)}
					</pre>
				</details>
			</article>
		</MainContent>
	);
}
