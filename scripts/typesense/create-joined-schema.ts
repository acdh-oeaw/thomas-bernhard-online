import { assert } from "@acdh-oeaw/lib";
import { Client, type ImportResponseFail } from "typesense";

import { env } from "@/config/env.config";
import { clientConfig } from "@/config/typesense.config";
import { defineCollection, type DocumentFromSchema } from "@/lib/typesense/schema";

/**
 * Creates a set of throwaway `tbo_test_*` collections that model the same data as the flat,
 * nested-object `tbo_work` collection — but with the nested `expressions` / `performances` objects
 * split out into their own collections, wired back to the work via a Typesense JOIN. Each collection
 * is seeded with a handful of dummy documents so the join can be queried right away.
 *
 * Run with `pnpm run typesense:create-joined-schema` (pass `--recreate` to drop any pre-existing
 * `tbo_test_*` collection first). Needs an admin api key — the search-only key used by the app (and
 * by `createTypesenseClient`) cannot create collections.
 */

/**
 * The admin key is deliberately NOT part of `@/config/env.config`: it must never be bundled into
 * the client. Read it straight from the environment (populated from `.env.local` by `dotenv-cli`).
 */
// eslint-disable-next-line no-restricted-syntax -- admin-only, server-side script (see above).
const adminApiKey = process.env.NEXT_PUBLIC_TYPESENSE_ADMIN_KEY;

const workCollectionName = "tbo_test_work";
const expressionsCollectionName = "tbo_test_expressions";
const performancesCollectionName = "tbo_test_performances";

/**
 * The join key. Every joined document points at its work through a `reference` foreign key of the
 * form `"<collection>.<field>"`; `id` is typesense's own always-indexed document id, so no extra
 * field is needed on the work side.
 */
const workReference = `${workCollectionName}.id`;

/**
 * `tbo_work` minus its nested objects: the `authors` / `expressions` / `performances` `object[]`
 * fields (and their flattened `.id` / `.title` / … sub-fields) are dropped, leaving the work's own
 * scalar fields. `enable_nested_fields` is therefore not needed here.
 */
const workCollection = defineCollection({
	fields: [
		{ name: "sameas", type: "string[]" },
		{ name: "category", type: "string", optional: true, facet: true },
		{ name: "title", type: "string", sort: true },
	] as const,
});

/**
 * The `expressions` object type of `tbo_work`, promoted to its own collection. The object's `id`
 * sub-field becomes the typesense document id, so it is not declared as a field; the array-ness of
 * `expressions.title` / `expressions.language` was an artifact of typesense flattening an
 * `object[]`, so those are plain `string`s per document here.
 */
const expressionsCollection = defineCollection({
	fields: [
		{ name: "work_id", type: "string", reference: workReference },
		{ name: "type", type: "string" },
		{ name: "title", type: "string", optional: true },
		{ name: "language", type: "string", optional: true },
	] as const,
});

/** The `performances` object type of `tbo_work`, promoted to its own collection (see above). */
const performancesCollection = defineCollection({
	fields: [
		{ name: "work_id", type: "string", reference: workReference },
		{ name: "type", type: "string" },
		{ name: "label", type: "string", optional: true },
	] as const,
});

/**
 * Dummy documents, shaped like the live `tbo_work` data (numeric-string ids, `category` values such
 * as "prose" / "drama", ISO language codes) but entirely made up — `sameas` uses an obviously
 * synthetic `example.org` namespace so no fabricated authority record can be mistaken for a real one.
 *
 * They deliberately cover the interesting join cases: a work with both expressions and performances,
 * one with expressions only, and one with neither (an unmatched left side). Optional fields are left
 * off some documents so a missing `title` / `label` is exercised too.
 */
const workDocuments: Array<DocumentFromSchema<typeof workCollection>> = [
	{ id: "1", title: "Frost", category: "prose", sameas: ["https://example.org/id/work/1"] },
	{ id: "2", title: "Die Jagdgesellschaft", category: "drama", sameas: [] },
	{ id: "3", title: "Tod und Thymian", category: "poetry", sameas: [] },
];

const expressionDocuments: Array<DocumentFromSchema<typeof expressionsCollection>> = [
	{ id: "101", work_id: "1", type: "expression", title: "Gelo", language: "it" },
	{ id: "102", work_id: "1", type: "expression", title: "Frost", language: "en" },
	{ id: "103", work_id: "2", type: "expression", title: "La Partie de chasse", language: "fr" },
	// No `title`: an expression known only by its language.
	{ id: "104", work_id: "2", type: "expression", language: "es" },
];

const performanceDocuments: Array<DocumentFromSchema<typeof performancesCollection>> = [
	{ id: "201", work_id: "2", type: "performance", label: "Burgtheater Wien, 1974" },
	{ id: "202", work_id: "2", type: "performance", label: "Schauspielhaus Zürich, 1975" },
	// No `label`: a performance recorded without one.
	{ id: "203", work_id: "1", type: "performance" },
];

/** Referenced collections must exist before the collections referencing them, so order matters. */
const collectionsToCreate = [
	{ name: workCollectionName, collection: workCollection, documents: workDocuments },
	{
		name: expressionsCollectionName,
		collection: expressionsCollection,
		documents: expressionDocuments,
	},
	{
		name: performancesCollectionName,
		collection: performancesCollection,
		documents: performanceDocuments,
	},
];

/** Dropping a referenced collection fails while a referencing one still exists — drop in reverse. */
const collectionsToDrop = [...collectionsToCreate].reverse();

const shouldRecreate = process.argv.slice(2).includes("--recreate");

function createAdminClient(): Client {
	assert(
		adminApiKey,
		"Missing `NEXT_PUBLIC_TYPESENSE_ADMIN_KEY` environment variable (see `.env.local`).",
	);

	return new Client({
		...clientConfig,
		apiKey: adminApiKey,
		nodes: [
			{
				host: env.NEXT_PUBLIC_TYPESENSE_HOST,
				port: env.NEXT_PUBLIC_TYPESENSE_PORT,
				protocol: env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
			},
		],
	});
}

async function exists(client: Client, name: string): Promise<boolean> {
	return client.collections(name).exists();
}

/**
 * Bulk-imports the dummy documents. Typesense's import endpoint reports per-document failures in its
 * response body rather than by rejecting, so the results have to be inspected — otherwise a document
 * whose `work_id` points at a non-existent work (a broken join) would fail silently.
 */
async function importDocuments(
	client: Client,
	name: string,
	documents: Array<Record<string, unknown>>,
): Promise<void> {
	const results = await client
		.collections(name)
		.documents()
		.import(documents, { action: "create" });

	const failures = results.filter((result): result is ImportResponseFail => {
		return !result.success;
	});

	if (failures.length > 0) {
		throw new Error(
			`Failed to import ${String(failures.length)} of ${String(documents.length)} documents into ${name}:\n${failures
				.map((failure) => {
					return `  ${failure.id ?? "?"}: ${failure.error}`;
				})
				.join("\n")}`,
		);
	}
}

/**
 * Pulls both joined collections in, nested under their collection name. Naming a collection here is
 * necessary but NOT sufficient: without a matching `$collection(...)` clause in `filter_by`,
 * typesense silently returns the works with no joined documents attached at all.
 *
 * `strategy:nest_array` is deliberate — the default `nest` strategy varies the *shape* of the joined
 * value with the number of matches (a bare object for a single match, an array for several), while
 * `nest_array` always yields an array, which is what makes the joined value's type predictable.
 */
const joinedIncludeFields = `*,$${expressionsCollectionName}(*,strategy:nest_array),$${performancesCollectionName}(*,strategy:nest_array)`;

/**
 * Reads the seeded works back *through* the join, so a run visibly proves the references resolve.
 * Both joined collections reference `tbo_test_work`, so these are reverse joins.
 */
async function reportJoinedWorks(
	client: Client,
	{ description, filterBy }: { description: string; filterBy: string },
): Promise<void> {
	const results = await client
		.collections<Record<string, unknown>>(workCollectionName)
		.documents()
		.search({
			q: "*",
			filter_by: filterBy,
			include_fields: joinedIncludeFields,
			sort_by: "title:asc",
		});

	console.warn(
		`\n${description}\n  filter_by: ${filterBy}\n  → ${String(results.found)} of ${String(workDocuments.length)} works:`,
	);
	// Pretty-printed, and indented one level so each document reads as part of the block above.
	for (const hit of results.hits ?? []) {
		console.warn(JSON.stringify(hit.document, null, 2).replaceAll(/^/gm, "  "));
	}
}

/**
 * INNER join: a bare `$collection(...)` clause requires a match, so works with no referencing
 * document drop out of the result entirely — here the work seeded with neither an expression nor a
 * performance, which is why a wildcard `id:*` filter still returns fewer works than exist.
 */
const innerJoinFilter = `$${expressionsCollectionName}(id:*) && $${performancesCollectionName}(id:*)`;

/**
 * LEFT join: OR-ing each join clause with a condition satisfied by every work (`id:*`) keeps the
 * unmatched works in the result, with the joined key simply absent on them. Each clause is
 * parenthesised so the `||` binds to its own join rather than across both of them.
 */
const leftJoinFilter = `($${expressionsCollectionName}(id:*) || id:*) && ($${performancesCollectionName}(id:*) || id:*)`;

async function main() {
	const client = createAdminClient();

	console.warn(
		`Creating collections on ${env.NEXT_PUBLIC_TYPESENSE_PROTOCOL}://${env.NEXT_PUBLIC_TYPESENSE_HOST}:${String(env.NEXT_PUBLIC_TYPESENSE_PORT)}`,
	);

	if (shouldRecreate) {
		for (const { name } of collectionsToDrop) {
			if (await exists(client, name)) {
				await client.collections(name).delete();
				console.warn(`  🗑 dropped existing collection ${name}`);
			}
		}
	} else {
		const existing: Array<string> = [];
		for (const { name } of collectionsToCreate) {
			if (await exists(client, name)) {
				existing.push(name);
			}
		}
		if (existing.length > 0) {
			throw new Error(
				`Collection(s) already exist: ${existing.join(", ")}. Re-run with --recreate to drop and re-create them.`,
			);
		}
	}

	for (const { name, collection, documents } of collectionsToCreate) {
		const created = await client.collections().create(collection.schema(name));
		// Documents referencing a work must be imported after that work exists, which the creation
		// order already guarantees — typesense rejects a `reference` pointing at a missing document.
		await importDocuments(client, name, documents);
		console.warn(
			`  ✓ ${name} (${String(created.fields.length)} fields, ${String(documents.length)} documents)`,
		);
	}

	console.warn(
		`\n✓ Created ${String(collectionsToCreate.length)} collections. ${expressionsCollectionName} and ${performancesCollectionName} join ${workCollectionName} via \`work_id\`.`,
	);

	await reportJoinedWorks(client, {
		description: "Inner join — only works that have both an expression and a performance:",
		filterBy: innerJoinFilter,
	});
	await reportJoinedWorks(client, {
		description: "Left join — every work, joined documents attached where they exist:",
		filterBy: leftJoinFilter,
	});
}

main().catch((error: unknown) => {
	console.error("Failed to create collections:", error);
	process.exit(1);
});
