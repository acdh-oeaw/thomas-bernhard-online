import { assert } from "@acdh-oeaw/lib";
import { Client, type ImportResponseFail } from "typesense";
import { pathToFileURL } from "url";

import { env } from "@/config/env.config";
import { clientConfig } from "@/config/typesense.config";
import { physicalCollectionName } from "@/lib/typesense/collection-name";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";
import { defineCollection, type DocumentFromSchema } from "@/lib/typesense/schema";

/**
 * Creates the collections that model the same data as the flat, nested-object `tbo_work` collection
 * — but with the nested `expressions` / `performances` objects split out into their own collections,
 * wired back to the work via a Typesense JOIN. They are seeded from the live source collection
 * itself (`--source=`, default `tbo_work`), taken apart along its nested objects, so the join can be
 * queried against real data right away.
 *
 * The names below are the *registry* names; the collections are created under
 * `NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX` + that name, so this script writes exactly the
 * collections the app then reads (`physicalCollectionName`).
 *
 * Run with `pnpm run typesense:create-joined-schema` (pass `--recreate` to drop any pre-existing
 * collection first). Needs an admin api key — the search-only key used by the app (and by
 * `createTypesenseClient`) cannot create collections.
 */

/**
 * The admin key is deliberately NOT part of `@/config/env.config`: it must never be bundled into
 * the client. Read it straight from the environment (populated from `.env.local` by `dotenv-cli`).
 */
// eslint-disable-next-line no-restricted-syntax -- admin-only, server-side script (see above).
const adminApiKey = process.env.NEXT_PUBLIC_TYPESENSE_ADMIN_KEY;

export const workCollectionName = "work";
export const authorsCollectionName = "authors";
export const expressionsCollectionName = "expressions";
export const performancesCollectionName = "performances";

/**
 * These collections are the nested-object `tbo_work` schema taken apart along its `object[]` fields,
 * so that resolving the joins puts it back together. The original:
 *
 *     authors:      object[] of { id, name }
 *     expressions:  object[] of { id, title, language }
 *     performances: object[] of { id, label }
 *     sameas: string[], category: string, title: string
 *
 * Each `object[]` becomes a collection of its element type. The elements' `id` sub-field becomes the
 * typesense document id, so it is never declared as a field; and the array-ness of the sub-fields
 * (`expressions.title: string[]`) was an artifact of typesense flattening an `object[]`, so they are
 * plain `string`s per document here. `enable_nested_fields` is therefore not needed anywhere.
 *
 * The two directions are deliberate, because the underlying relationships differ:
 *
 * - expressions and performances belong to exactly one work, so they carry the reference
 *   (`work_id`), and a search on the works reaches them through a REVERSE join;
 * - an author has many works and a work has many authors, so duplicating the author per work would
 *   be wrong. The work carries an array reference (`author_ids`) instead, and reaches its authors
 *   through a FORWARD join.
 *
 * References are stored *physically*: the created collections know nothing of the registry's
 * unprefixed naming. `get-schema.ts` strips the prefix again when generating the registry, so the
 * joins resolve there, and `as <registry name>` aliases keep the prefix out of query responses.
 */
const workReference = `${physicalCollectionName(workCollectionName)}.id`;
const authorsReference = `${physicalCollectionName(authorsCollectionName)}.id`;

/**
 * The element type of the original `authors: object[]` — one document per person, not per work.
 * Unlike `expressions` and `performances` it carries no `type`: the work reaches it through a
 * forward reference, so there is nothing to tell apart on the joined side.
 */
const authorsCollection = defineCollection({
	fields: [{ name: "name", type: "string" }] as const,
});

/**
 * The work's own scalar fields, plus the `author_ids` array reference standing in for the nested
 * `authors` objects. `optional: true` mirrors `authors` having been optional — a work with no
 * `author_ids` simply joins to nothing.
 */
const workCollection = defineCollection({
	fields: [
		{ name: "author_ids", type: "string[]", optional: true, reference: authorsReference },
		{ name: "sameas", type: "string[]" },
		{ name: "category", type: "string", optional: true, facet: true },
		{ name: "title", type: "string", sort: true },
	] as const,
});

/**
 * The element type of the original `expressions: object[]`, pointing back at its work — and, through
 * `translator_ids`, at the same `authors` collection the work references. That second reference is
 * what makes a two-level join possible: work → expressions → authors (see `demonstrate-joins.ts`).
 * One collection serves both roles, so the field name carries the role while the join key follows
 * the collection; the seeded values are arbitrary.
 */
const expressionsCollection = defineCollection({
	fields: [
		{ name: "work_id", type: "string", reference: workReference },
		{ name: "translator_ids", type: "string[]", optional: true, reference: authorsReference },
		{ name: "type", type: "string" },
		{ name: "title", type: "string", optional: true },
		{ name: "language", type: "string", optional: true },
	] as const,
});

/** The element type of the original `performances: object[]`, pointing back at its work. */
const performancesCollection = defineCollection({
	fields: [
		{ name: "work_id", type: "string", reference: workReference },
		{ name: "type", type: "string" },
		{ name: "label", type: "string", optional: true },
	] as const,
});

/**
 * Referenced collections must exist before the collections referencing them, so order matters:
 * authors before works (the work references them), works before expressions and performances.
 */
const collectionsToCreate = [
	{ name: authorsCollectionName, collection: authorsCollection },
	{ name: workCollectionName, collection: workCollection },
	{ name: expressionsCollectionName, collection: expressionsCollection },
	{ name: performancesCollectionName, collection: performancesCollection },
] as const;

/** The documents to seed, keyed by the collection they belong in. */
interface SeedDocuments {
	authors: Array<DocumentFromSchema<typeof authorsCollection>>;
	work: Array<DocumentFromSchema<typeof workCollection>>;
	expressions: Array<DocumentFromSchema<typeof expressionsCollection>>;
	performances: Array<DocumentFromSchema<typeof performancesCollection>>;
}

/**
 * The live, nested-object collection the seed data is taken from — a *physical* name, unrelated to
 * this deployment's prefix, and not part of the registry. Override with `--source=<collection>`.
 */
const sourceCollectionName =
	process.argv
		.slice(2)
		.find((arg) => {
			return arg.startsWith("--source=");
		})
		?.slice("--source=".length) ?? "tbo_work";

/** One document of the source collection, as far as this script reads it. */
interface SourceWork {
	id: string;
	title: string;
	category?: string | null;
	sameas?: Array<string> | null;
	authors?: Array<{ id?: string; name?: string }> | null;
	expressions?: Array<{ id?: string; title?: string; language?: string }> | null;
	performances?: Array<{ id?: string; label?: string }> | null;
}

/**
 * Exports the whole source collection. `export` streams every document as JSONL, which is what makes
 * this a full copy rather than a paginated search capped at `per_page`. Read-only, and it needs only
 * the app's search key — the admin key is scoped to the collections this script writes.
 */
async function fetchSourceWorks(client: Client): Promise<Array<SourceWork>> {
	const jsonl = await client.collections(sourceCollectionName).documents().export();

	return jsonl
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			return JSON.parse(line) as SourceWork;
		});
}

/**
 * Invented translators, added to the `authors` collection alongside the real authors taken from the
 * source. The source carries no translator information at all, so without these the `translator_ids`
 * reference — and the two-level join that walks it in `demonstrate-joins.ts` — would resolve to
 * nothing on every expression.
 *
 * These people do not exist. Their ids are prefixed `invented-` so that a document sourced from the
 * live data can never be confused with one made up here, in the seed data or in a query result.
 */
const inventedTranslators: Array<DocumentFromSchema<typeof authorsCollection>> = [
	{ id: "invented-1", name: "Ada Lindqvist" },
	{ id: "invented-2", name: "Bruno Marchetti" },
	{ id: "invented-3", name: "Halina Woźniak" },
	{ id: "invented-4", name: "Ismael Duarte" },
	{ id: "invented-5", name: "Mira Kovač" },
	{ id: "invented-6", name: "Tomás Ferreira" },
];

/**
 * A number in [0, 1) derived from `seed` (FNV-1a). Deterministic on purpose: re-running the script
 * has to reproduce the same attributions, otherwise every run would reshuffle who translated what
 * and no result could be compared against a previous one.
 */
function pseudoRandom(seed: string): number {
	let hash = 2166136261;

	for (const character of seed) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}

	return (hash >>> 0) / 2 ** 32;
}

/**
 * Assigns invented translators to an expression: usually one, sometimes two, and for roughly one in
 * seven none at all — so the empty case the left join relies on stays represented.
 */
function pickTranslatorIds(expressionId: string): Array<string> {
	const wanted = pseudoRandom(`${expressionId}:count`);
	const count = wanted < 0.15 ? 0 : wanted < 0.85 ? 1 : 2;
	const picked: Array<string> = [];

	for (const attempt of inventedTranslators.keys()) {
		if (picked.length === count) {
			break;
		}
		const index = Math.floor(
			pseudoRandom(`${expressionId}:${String(attempt)}`) * inventedTranslators.length,
		);
		const id = inventedTranslators[index]?.id;
		// A repeat means this draw is wasted; the next attempt uses a different seed. Two draws landing
		// on the same person just leaves the expression with one translator.
		if (id != null && !picked.includes(id)) {
			picked.push(id);
		}
	}

	return picked;
}

/** What the source data lost on the way in, reported after seeding rather than passed over. */
interface SeedSkips {
	/** Nested entries with no `id`, which cannot become a document. */
	withoutId: number;
	/** Ids that appeared under more than one work; the first occurrence wins. */
	duplicateIds: Array<string>;
}

/**
 * Turns the nested source documents into the four flat collections — the inverse of the join query
 * in `reportJoinedWorks`.
 *
 * The real data is not as tidy as the schema suggests, so two things are dropped rather than allowed
 * to fail the import:
 *
 * - nested entries without an `id` (the source has a handful of empty `performances` entries): the
 *   `id` is what a document is addressed by, and inventing one would fabricate a record;
 * - repeated ids: an expression id can appear under several works, and importing with
 *   `action: "create"` rejects the second. The first occurrence wins, which also picks a single work
 *   for its `work_id` — the split schema has no way to express one expression belonging to two works.
 *
 * `translator_ids` has no counterpart in the source, so it is filled from `inventedTranslators` —
 * the one part of the seed data that is made up rather than copied. Every other value here comes
 * from the source collection.
 */
function toSeedDocuments(works: Array<SourceWork>): {
	documents: SeedDocuments;
	skips: Record<"authors" | "expressions" | "performances", SeedSkips>;
} {
	const authorsById = new Map<string, DocumentFromSchema<typeof authorsCollection>>();
	const expressionsById = new Map<string, DocumentFromSchema<typeof expressionsCollection>>();
	const performancesById = new Map<string, DocumentFromSchema<typeof performancesCollection>>();

	const skips: Record<"authors" | "expressions" | "performances", SeedSkips> = {
		authors: { withoutId: 0, duplicateIds: [] },
		expressions: { withoutId: 0, duplicateIds: [] },
		performances: { withoutId: 0, duplicateIds: [] },
	};

	const workDocuments = works.map((work) => {
		const authorIds: Array<string> = [];

		for (const author of work.authors ?? []) {
			if (author.id == null) {
				skips.authors.withoutId += 1;
				continue;
			}
			// Every work repeats its authors inline; the collection holds one document per person, so a
			// repeat is the expected case here rather than a skip.
			if (!authorsById.has(author.id)) {
				authorsById.set(author.id, { id: author.id, name: author.name ?? "" });
			}
			if (!authorIds.includes(author.id)) {
				authorIds.push(author.id);
			}
		}

		for (const expression of work.expressions ?? []) {
			if (expression.id == null) {
				skips.expressions.withoutId += 1;
				continue;
			}
			if (expressionsById.has(expression.id)) {
				skips.expressions.duplicateIds.push(expression.id);
				continue;
			}
			const translatorIds = pickTranslatorIds(expression.id);

			expressionsById.set(expression.id, {
				id: expression.id,
				work_id: work.id,
				type: "expression",
				...(translatorIds.length > 0 && { translator_ids: translatorIds }),
				...(expression.title != null && { title: expression.title }),
				...(expression.language != null && { language: expression.language }),
			});
		}

		for (const performance of work.performances ?? []) {
			if (performance.id == null) {
				skips.performances.withoutId += 1;
				continue;
			}
			if (performancesById.has(performance.id)) {
				skips.performances.duplicateIds.push(performance.id);
				continue;
			}
			performancesById.set(performance.id, {
				id: performance.id,
				work_id: work.id,
				type: "performance",
				...(performance.label != null && { label: performance.label }),
			});
		}

		return {
			id: work.id,
			title: work.title,
			sameas: work.sameas ?? [],
			// Both are optional in the schema, so an absent value is left off rather than sent empty.
			...(work.category != null && work.category !== "" && { category: work.category }),
			...(authorIds.length > 0 && { author_ids: authorIds }),
		};
	});

	return {
		documents: {
			// The invented translators are referenced by `translator_ids`, so they have to be documents
			// in the same collection as the real authors — one `authors` collection serves both roles.
			authors: [...authorsById.values(), ...inventedTranslators],
			work: workDocuments,
			expressions: [...expressionsById.values()],
			performances: [...performancesById.values()],
		},
		skips,
	};
}

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

/** Takes a registry name and checks the physical collection it maps to. */
async function exists(client: Client, name: string): Promise<boolean> {
	return client.collections(physicalCollectionName(name)).exists();
}

/**
 * The collections this script would create that do not exist (yet), in creation order, named as the
 * registry names them. Exported so other scripts — `demonstrate-joins.ts` — can check whether the
 * join schema is in place before querying it, rather than failing with a bare 404. Any client scoped
 * to these collections works; the app's search key is enough, since this only reads schemas.
 */
export async function findMissingCollections(client: Client): Promise<Array<string>> {
	const missing: Array<string> = [];

	for (const { name } of collectionsToCreate) {
		if (!(await exists(client, name))) {
			missing.push(name);
		}
	}

	return missing;
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
		.collections(physicalCollectionName(name))
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
 * A `$collection(...)` join clause, which typesense resolves against *physical* collection names.
 * The trailing `as <registry name>` keys the joined documents by the registry name instead of the
 * prefixed one, so the response shape matches the generated collection registry (and the types
 * derived from it) rather than leaking the deployment's prefix.
 */
function joinClause(name: string, fields: string): string {
	return `$${physicalCollectionName(name)}(${fields}) as ${name}`;
}

/**
 * Pulls all three joined collections in, nested under their registry name — the query that puts the
 * original nested `tbo_work` document back together.
 *
 * Each clause takes the whole joined document (`*`), so the reconstituted arrays carry a little more
 * than the `object[]` elements used to: the `work_id` / `type` bookkeeping fields that only exist
 * because the objects became collections of their own, and `author_ids` remains on the work beside
 * the `authors` it resolves to. Narrowing a clause to `id,title,language` would reproduce the old
 * element type exactly, at the cost of a query that has to restate the schema.
 *
 * `strategy:nest_array` is deliberate throughout — the default `nest` strategy varies the *shape* of
 * the joined value with the number of matches (a bare object for a single match, an array for
 * several), while `nest_array` always yields an array, matching the `object[]` it stands in for.
 *
 * Naming a collection here is necessary but NOT sufficient for the *reverse* joins: without a
 * matching `$collection(...)` clause in `filter_by`, typesense silently returns the works with no
 * expressions or performances attached. The forward `authors` join needs no such clause.
 */
const joinedIncludeFields = [
	authorsCollectionName,
	expressionsCollectionName,
	performancesCollectionName,
]
	.map((name) => {
		return joinClause(name, "*,strategy:nest_array");
	})
	.join(",");

/**
 * Reads the seeded works back *through* the join, so a run visibly proves the references resolve.
 * Both joined collections reference the work collection, so these are reverse joins.
 */
async function reportJoinedWorks(
	client: Client,
	{
		description,
		filterBy,
		totalWorks,
	}: { description: string; filterBy: string; totalWorks: number },
): Promise<void> {
	// Only a couple of examples: the seeded data is the whole live collection, not three fixtures.
	const sampleSize = 2;

	const results = await client
		.collections<Record<string, unknown>>(physicalCollectionName(workCollectionName))
		.documents()
		.search({
			q: "*",
			filter_by: filterBy,
			include_fields: joinedIncludeFields,
			sort_by: "title:asc",
			per_page: sampleSize,
		});

	console.warn(
		`\n${description}\n  filter_by: ${filterBy}\n  → ${String(results.found)} of ${String(totalWorks)} works, showing ${String(Math.min(sampleSize, results.found))}:`,
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
const innerJoinFilter = `$${physicalCollectionName(expressionsCollectionName)}(id:*) && $${physicalCollectionName(performancesCollectionName)}(id:*)`;

/**
 * LEFT join: OR-ing each join clause with a condition satisfied by every work (`id:*`) keeps the
 * unmatched works in the result, with the joined key simply absent on them. Each clause is
 * parenthesised so the `||` binds to its own join rather than across both of them.
 */
const leftJoinFilter = `($${physicalCollectionName(expressionsCollectionName)}(id:*) || id:*) && ($${physicalCollectionName(performancesCollectionName)}(id:*) || id:*)`;

/** Reports what the source data lost on the way in (see `toSeedDocuments`). */
function reportSkips(skips: Record<string, SeedSkips>): void {
	for (const [name, { withoutId, duplicateIds }] of Object.entries(skips)) {
		if (withoutId > 0) {
			console.warn(`  ⚠ ${name}: skipped ${String(withoutId)} source entr(ies) without an id`);
		}
		if (duplicateIds.length > 0) {
			const unique = [...new Set(duplicateIds)];
			console.warn(
				`  ⚠ ${name}: skipped ${String(duplicateIds.length)} repeat(s) of ${String(unique.length)} id(s) already seen under another work: ${unique.join(", ")}`,
			);
		}
	}
}

async function main() {
	const client = createAdminClient();

	console.warn(
		`Creating collections on ${env.NEXT_PUBLIC_TYPESENSE_PROTOCOL}://${env.NEXT_PUBLIC_TYPESENSE_HOST}:${String(env.NEXT_PUBLIC_TYPESENSE_PORT)}`,
	);

	// The source collection is outside the admin key's scope, so it is read with the app's search key.
	const sourceWorks = await fetchSourceWorks(createTypesenseClient());
	const { documents, skips } = toSeedDocuments(sourceWorks);
	console.warn(
		`  ↓ read ${String(sourceWorks.length)} documents from ${sourceCollectionName} to seed from`,
	);
	reportSkips(skips);

	if (shouldRecreate) {
		for (const { name } of collectionsToDrop) {
			if (await exists(client, name)) {
				await client.collections(physicalCollectionName(name)).delete();
				console.warn(`  🗑 dropped existing collection ${physicalCollectionName(name)}`);
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

	for (const { name, collection } of collectionsToCreate) {
		const created = await client
			.collections()
			.create(collection.schema(physicalCollectionName(name)));
		// Documents referencing a work must be imported after that work exists, which the creation
		// order already guarantees — typesense rejects a `reference` pointing at a missing document.
		await importDocuments(client, name, documents[name]);
		console.warn(
			`  ✓ ${created.name} (${String(created.fields.length)} fields, ${String(documents[name].length)} documents)`,
		);
	}

	console.warn(
		`\n✓ Created ${String(collectionsToCreate.length)} collections. ${expressionsCollectionName} and ${performancesCollectionName} reference ${workCollectionName} via \`work_id\`; ${workCollectionName} references ${authorsCollectionName} via \`author_ids\`. Resolving all three reconstitutes the nested document:`,
	);

	await reportJoinedWorks(client, {
		description: "Inner join — only works that have both an expression and a performance:",
		filterBy: innerJoinFilter,
		totalWorks: documents.work.length,
	});
	await reportJoinedWorks(client, {
		description: "Left join — every work, joined documents attached where they exist:",
		filterBy: leftJoinFilter,
		totalWorks: documents.work.length,
	});
}

// Only create anything when this file is *run*; importing it (see `demonstrate-joins.ts`, which
// reuses the collection names and `findMissingCollections`) must have no side effects.
if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		console.error("Failed to create collections:", error);
		process.exit(1);
	});
}
