import type { DocumentSchema, SearchOptions, SearchParams, SearchResponse } from "typesense";

import { defaultSearchParams } from "@/config/typesense.config";
import type {
	TranslationWithRelations,
	WorkWithRelations as AppWorkWithRelations,
} from "@/lib/data";
import { physicalCollectionName } from "@/lib/typesense/collection-name";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import {
	authorsCollectionName,
	findMissingCollections,
	performancesCollectionName,
	translationsCollectionName,
	workCollectionName,
} from "@/scripts/typesense/create-joined-schema";

/** The demo schema retains an author reference that the production API no longer has. */
type WorkWithRelations = AppWorkWithRelations & {
	authors?: Array<{ id: string; name: string }>;
};

/**
 * Shows what a Typesense JOIN does to a search response, by running the same searches with and
 * without their join arguments and printing both results.
 *
 * Run with `pnpm run typesense:demonstrate-joins`. Read-only: it queries the collections that
 * `create-joined-schema.ts` creates and seeds, and refuses to run if they are missing. Only the
 * app's search key is needed.
 */

/**
 * A note on the `include_fields` strings below: none of them carries a leading `*`. An
 * `include_fields` made up of nothing but `$collection(...)` join clauses leaves the *local*
 * projection alone, so every field of the searched collection is still returned — the wildcard would
 * be redundant. It only starts to matter once a local field is named: `include_fields=title,$work(*)`
 * narrows the local document to `title`, and `*` is how you would widen it back.
 */

/**
 * A `$collection(...)` join clause. Typesense resolves it against the *physical* collection name, so
 * the deployment prefix has to go back in here; `as <registry name>` then keys the joined documents
 * by the unprefixed name, which is what the registry — and every type derived from it — uses.
 */
function joinClause(name: string, fields: string): string {
	return `$${physicalCollectionName(name)}(${fields}) as ${name}`;
}

/** A `filter_by` join clause. No alias: `filter_by` only selects documents, it names no output key. */
function joinFilterClause(name: string, filter: string): string {
	return `$${physicalCollectionName(name)}(${filter})`;
}

function searchPhysicalCollection<D extends DocumentSchema>(
	name: string,
	params: SearchParams<D>,
	options?: SearchOptions,
): Promise<SearchResponse<D>> {
	return createTypesenseClient()
		.collections<D>(physicalCollectionName(name))
		.documents()
		.search({ ...defaultSearchParams, ...params }, options);
}

/**
 * Hits per example query. The collections hold the whole live dataset (187 works, 1258 translations),
 * so every query takes a small sample — this script is about the shape of a response, not its size.
 */
const samplePerPage = 3;

/** Pretty-prints the documents of a search, indented one level under its heading. */
function printDocuments(documents: Array<unknown>): void {
	for (const document of documents) {
		console.warn(JSON.stringify(document, null, 2).replaceAll(/^/gm, "  "));
	}
}

function printHeading(title: string, params: Record<string, string | undefined>): void {
	console.warn(`\n${"─".repeat(96)}\n${title}`);
	for (const [key, value] of Object.entries(params)) {
		if (value != null) {
			console.warn(`  ${key}: ${value}`);
		}
	}
}

/**
 * FORWARD join, the direction the schema declares: each translation carries a `work_id` reference, so
 * the work it belongs to can be pulled into the translation's document. Naming the collection in
 * `include_fields` is all it takes — no `filter_by` clause is involved (contrast the reverse
 * direction below, where the same query silently returns nothing joined).
 *
 * A `filter_by` join clause would change *which documents match* rather than their shape:
 * it makes the join an inner one, which is only observable when the reference can be absent. Here
 * `work_id` is required, so every translation has a work and the filter would drop nothing.
 *
 * The default `nest` strategy is deliberate (rather than the `nest_array` used for the reverse
 * direction): this join is many-to-one, so a single work comes back as a bare object — which is
 * exactly the bare-object shape declared by `TranslationWithRelations`, the local `work_id` field not
 * being an array.
 */
const forwardJoinIncludeFields = joinClause(workCollectionName, "*");

/**
 * The same forward join, carried one level further: translation → work → authors. The work pulled in
 * by the translation pulls in its own authors, so a single search on the translations answers "who
 * wrote the work this is a translation of".
 *
 * Both levels are forward references (`work_id`, then `author_ids`), so neither needs a `filter_by`
 * clause — unlike the two-level join at the end of the script, whose outer level is a reverse join.
 * The inner clause carries `strategy:nest_array` because `author_ids` is an array reference, and its
 * own `as authors` alias, without which the inner key would keep the physical collection name.
 */
const forwardNestedJoinIncludeFields = joinClause(
	workCollectionName,
	`*,${joinClause(authorsCollectionName, "*,strategy:nest_array")}`,
);

/**
 * The same again, plus the translation's *own* link to the authors collection — its `translator_ids`.
 * One search then answers both "who wrote the original" and "who translated this".
 *
 * Both land under the key `authors`, because a joined key is named after the target collection and
 * not after the field pointing at it: the translation's translators at the top level, the work's
 * authors one level down inside `work`. Aliasing the outer one `as translators` would read better but
 * would no longer match the explicit `TranslationWithRelations` response shape — the typed access
 * below would then be reading a key the response does not have.
 */
const translatorJoinIncludeFields = [
	joinClause(authorsCollectionName, "*,strategy:nest_array"),
	forwardNestedJoinIncludeFields,
].join(",");

/**
 * The work's own joins, in both directions at once — resolving them reconstitutes the nested document
 * the split-up schema was derived from (`authors` / `translations` / `performances` as arrays).
 *
 * - `authors` is FORWARD, through the work's own `author_ids` array reference, so `include_fields`
 *   alone materialises it — as in the translations search above.
 * - `translations` and `performances` are REVERSE: nothing on the work points at them, so the join is
 *   driven from the other side. Unlike the forward direction, `include_fields` alone is not enough —
 *   without a matching `$collection(...)` clause in `filter_by`, typesense returns the works with no
 *   joined documents attached and no error at all.
 *
 * OR-ing each `filter_by` clause with `id:*` makes it a left join, keeping works that have no
 * translation or performance, and `strategy:nest_array` keeps every joined value an array whether one
 * or several documents match — matching the `object[]` each one stands in for.
 */
const reverseJoinFilter = [translationsCollectionName, performancesCollectionName]
	.map((name) => {
		return `(${joinFilterClause(name, "id:*")} || id:*)`;
	})
	.join(" && ");
const reverseJoinIncludeFields = [
	authorsCollectionName,
	translationsCollectionName,
	performancesCollectionName,
]
	.map((name) => {
		return joinClause(name, "*,strategy:nest_array");
	})
	.join(",");

/**
 * A NESTED join, two levels deep: work ← translations → authors. A join clause may itself contain a
 * join clause, so the translations pulled in by the work each pull in their own translators
 * (`translations.translator_ids` points at the same `authors` collection the work's `author_ids` do,
 * which is why the joined key is `authors` rather than the field's name).
 *
 * The inner clause takes its own `as authors` alias; without it the inner key keeps the physical
 * collection name (`tbo_test_authors`) even though the outer one was aliased.
 *
 * The `filter_by` requirement applies to the outer, reverse level only — the inner forward join
 * resolves from `include_fields` alone, and a translation with no `author_ids` simply comes back
 * without the key.
 */
const nestedJoinIncludeFields = joinClause(
	translationsCollectionName,
	`*,${joinClause(authorsCollectionName, "*,strategy:nest_array")},strategy:nest_array`,
);

async function demonstrateTranslationJoins(): Promise<void> {
	const params = { q: "*", per_page: samplePerPage } as const;

	printHeading(`1. ${translationsCollectionName} WITHOUT join`, { q: params.q });
	const plain = await searchPhysicalCollection(translationsCollectionName, params);
	printDocuments(
		(plain.hits ?? []).map((hit) => {
			return hit.document;
		}),
	);

	printHeading(`2. ${translationsCollectionName} WITH join (forward: translation → work)`, {
		include_fields: forwardJoinIncludeFields,
	});
	const joined = await searchPhysicalCollection<TranslationWithRelations>(
		translationsCollectionName,
		{
			...params,
			include_fields: forwardJoinIncludeFields,
		},
	);
	printDocuments(
		(joined.hits ?? []).map((hit) => {
			return hit.document;
		}),
	);

	// The joined document is *typed*, not just present: `work` below is the work document type.
	const titles = (joined.hits ?? []).map((hit) => {
		const work = hit.document.work;
		return `${hit.document.title} → ${work?.title ?? "(not joined)"}`;
	});
	console.warn(
		`\n  typed access — translation title → joined work title:\n    ${titles.join("\n    ")}`,
	);

	printHeading(
		`3. ${translationsCollectionName} WITH two-level join (translation → work → ${authorsCollectionName})`,
		{ include_fields: forwardNestedJoinIncludeFields },
	);
	const nested = await searchPhysicalCollection<TranslationWithRelations>(
		translationsCollectionName,
		{
			...params,
			include_fields: forwardNestedJoinIncludeFields,
		},
	);
	printDocuments(
		(nested.hits ?? []).map((hit) => {
			return hit.document;
		}),
	);

	// `work` is typed as before; the `authors` inside it is not — see the note under query 7. Reading
	// the first level and printing the rest keeps this honest about where the types stop.
	const attributions = (nested.hits ?? []).map((hit) => {
		return `${hit.document.title} → ${hit.document.work?.title ?? "(not joined)"}`;
	});
	console.warn(
		`\n  typed access stops at the first level — translation → work is typed, the work's \`${authorsCollectionName}\` is not:\n    ${attributions.join("\n    ")}`,
	);

	printHeading(
		`4. ${translationsCollectionName} WITH the same joins plus its own translators (\`translator_ids\`)`,
		{ include_fields: translatorJoinIncludeFields },
	);
	const withTranslators = await searchPhysicalCollection<TranslationWithRelations>(
		translationsCollectionName,
		{
			...params,
			include_fields: translatorJoinIncludeFields,
		},
	);
	printDocuments(
		(withTranslators.hits ?? []).map((hit) => {
			return hit.document;
		}),
	);

	// Both of the translation's own joins are first-level, so both are typed: `work` from `work_id`
	// (a single document) and `authors` from `translator_ids` (an array, because the reference field is
	// one). The work's own authors, a level deeper, are still untyped.
	const attributionsWithTranslators = (withTranslators.hits ?? []).map((hit) => {
		const translators = (hit.document.authors ?? []).map((translator) => {
			return translator.name;
		});
		return `${hit.document.title} (${hit.document.work?.title ?? "?"}) — translated by ${translators.length > 0 ? translators.join(", ") : "(nobody recorded)"}`;
	});
	console.warn(
		`\n  typed access — both first-level joins, \`work\` and the translators under \`${authorsCollectionName}\`:\n    ${attributionsWithTranslators.join("\n    ")}`,
	);
}

async function demonstrateWorkJoins(): Promise<void> {
	const params = { q: "*", sort_by: "title:asc", per_page: samplePerPage } as const;

	printHeading(`5. ${workCollectionName} WITHOUT join`, { q: params.q });
	const plain = await searchPhysicalCollection(workCollectionName, params);
	printDocuments(
		(plain.hits ?? []).map((hit) => {
			return hit.document;
		}),
	);

	printHeading(
		`6. ${workCollectionName} WITH all joins (→ authors, ← translations, performances)`,
		{
			filter_by: reverseJoinFilter,
			include_fields: reverseJoinIncludeFields,
		},
	);
	const joined = await searchPhysicalCollection<WorkWithRelations>(workCollectionName, {
		...params,
		filter_by: reverseJoinFilter,
		include_fields: reverseJoinIncludeFields,
	});
	printDocuments(
		(joined.hits ?? []).map((hit) => {
			return hit.document;
		}),
	);

	// All three are typed by the explicit `WorkWithRelations` response shape: `authors` is a forward
	// join through `author_ids`, while `translations` / `performances` are reverse joins. Each is
	// optional — hence the `?? 0` for the work seeded with no authors, and the one with neither
	// translations nor performances.
	const counts = (joined.hits ?? []).map((hit) => {
		const authors = hit.document.authors?.length ?? 0;
		const translations = hit.document.translations?.length ?? 0;
		const performances = hit.document.performances?.length ?? 0;
		return `${hit.document.title}: ${String(authors)} author(s), ${String(translations)} translation(s), ${String(performances)} performance(s)`;
	});
	console.warn(
		`\n  typed access — joined documents, keyed by the other collection:\n    ${counts.join("\n    ")}`,
	);
}

async function demonstrateNestedJoin(): Promise<void> {
	const filterBy = `${joinFilterClause(translationsCollectionName, "id:*")} || id:*`;

	printHeading(
		`7. ${workCollectionName} WITH two-level join (work ← ${translationsCollectionName} → ${authorsCollectionName})`,
		{ filter_by: filterBy, include_fields: nestedJoinIncludeFields },
	);
	const joined = await searchPhysicalCollection<WorkWithRelations>(workCollectionName, {
		q: "*",
		sort_by: "title:asc",
		per_page: samplePerPage,
		filter_by: filterBy,
		include_fields: nestedJoinIncludeFields,
	});
	printDocuments(
		(joined.hits ?? []).map((hit) => {
			return hit.document;
		}),
	);

	// Printed rather than read field by field, because `WorkWithRelations` models only the first-level
	// projection. `hit.document.translations` is typed, but `…translations[0].authors` is not — how deep
	// a query nests is a property of that individual query, not of the base collection.
	console.warn(
		`\n  the nested \`${authorsCollectionName}\` key is present at runtime but not in the document type —` +
			` only the first join level is modelled.`,
	);
}

async function main() {
	// The search key can read every `tbo_` collection, so the same client covers the existence check
	// and the searches `searchPhysicalCollection` runs.
	const missing = await findMissingCollections(createTypesenseClient());

	if (missing.length > 0) {
		throw new Error(
			`Missing collection(s): ${missing.join(", ")}. Run \`pnpm run typesense:create-joined-schema\` first.`,
		);
	}

	await demonstrateTranslationJoins();
	await demonstrateWorkJoins();
	await demonstrateNestedJoin();
}

main().catch((error: unknown) => {
	console.error("Failed to demonstrate joins:", error);
	process.exit(1);
});
