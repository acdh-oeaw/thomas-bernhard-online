import { assert } from "@acdh-oeaw/lib";
import { Client, type ImportResponseFail } from "typesense";
import type { CollectionSchema } from "typesense/lib/Typesense/Collection";
import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";

import { env } from "#/config/env.config.ts";
import { clientConfig } from "#/config/typesense.config.ts";
import { physicalCollectionName } from "#/lib/typesense/collection-name.ts";

/**
 * Copies the configured collections (schema and documents) from a shared typesense server into the
 * local development server started with `pnpm run typesense:local:up`.
 *
 * - Source: `TYPESENSE_SEED_HOST` (default `typesense.acdh.oeaw.ac.at`, https on port 443), read with
 *   `TYPESENSE_SEED_SEARCH_API_KEY` — a search key that may export documents is enough.
 * - Target: the `NEXT_PUBLIC_TYPESENSE_*` server, written with `TYPESENSE_ADMIN_API_KEY`. Only a
 *   local host is accepted, so this script can never write to a shared server.
 *
 * Collections listed in `NEXT_PUBLIC_TYPESENSE_COLLECTIONS` are copied together with every
 * collection they reference, in reference order. Finally a search-only key with the value of
 * `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY` is created, so the app can use the local server
 * unchanged.
 *
 * Pass `--recreate` to drop and re-create collections that already exist locally.
 */

/* oxlint-disable app/no-process-env -- admin-only, server-side script. */
const adminApiKey = process.env.TYPESENSE_ADMIN_API_KEY;
const seedHost = process.env.TYPESENSE_SEED_HOST ?? "typesense.acdh.oeaw.ac.at";
const seedApiKey = process.env.TYPESENSE_SEED_SEARCH_API_KEY;
/* oxlint-enable app/no-process-env */

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "typesense"]);

const shouldRecreate = process.argv.slice(2).includes("--recreate");

function createSourceClient(): Client {
	assert(seedApiKey, "Missing `TYPESENSE_SEED_SEARCH_API_KEY` environment variable.");

	return new Client({
		...clientConfig,
		connectionTimeoutSeconds: 60,
		apiKey: seedApiKey,
		nodes: [{ host: seedHost, port: 443, protocol: "https" }],
	});
}

function createTargetClient(): Client {
	assert(adminApiKey, "Missing `TYPESENSE_ADMIN_API_KEY` environment variable.");
	assert(
		localHosts.has(env.NEXT_PUBLIC_TYPESENSE_HOST),
		`Refusing to seed "${env.NEXT_PUBLIC_TYPESENSE_HOST}": only a local typesense server can be seeded.`,
	);

	return new Client({
		...clientConfig,
		connectionTimeoutSeconds: 60,
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

/**
 * Physical names of the collections a schema references (`"tbo_work.id"` → `"tbo_work"`). With
 * `async: false`, only synchronous references — those whose target document must already exist when
 * a referencing document is imported.
 */
function getReferences(schema: CollectionSchema, options: { async: boolean }): Array<string> {
	return schema.fields.flatMap((field) => {
		if (typeof field.reference !== "string") return [];
		if (!options.async && field.async_reference === true) return [];
		return [field.reference.split(".")[0]!];
	});
}

/**
 * Retrieves the schemas of the given collections and of everything they reference, ordered so that
 * every collection comes after the collections it references synchronously. Async references may
 * form cycles (e.g. performance ↔ poster) and impose no order.
 */
async function retrieveSchemas(
	client: Client,
	names: Array<string>,
): Promise<Array<CollectionSchema>> {
	const schemas = new Map<string, CollectionSchema>();
	const queue = [...names];

	while (queue.length > 0) {
		const name = queue.shift()!;
		if (schemas.has(name)) continue;

		const schema = await client.collections(name).retrieve();
		schemas.set(name, schema);
		queue.push(...getReferences(schema, { async: true }));
	}

	const ordered: Array<CollectionSchema> = [];
	const done = new Set<string>();
	const visiting = new Set<string>();

	function visit(name: string): void {
		if (done.has(name)) return;
		assert(!visiting.has(name), `Circular synchronous collection reference involving "${name}".`);
		visiting.add(name);

		const schema = schemas.get(name)!;
		for (const reference of getReferences(schema, { async: false })) {
			if (reference !== name) visit(reference);
		}

		visiting.delete(name);
		done.add(name);
		ordered.push(schema);
	}

	for (const name of schemas.keys()) {
		visit(name);
	}

	return ordered;
}

/** Drops the server-managed properties of a retrieved schema, so it can be used to create one. */
function toCreateSchema(schema: CollectionSchema): CollectionCreateSchema {
	const {
		created_at: _createdAt,
		num_documents: _numDocuments,
		num_memory_shards: _numMemoryShards,
		...createSchema
	} = schema;

	return createSchema;
}

async function importDocuments(client: Client, name: string, jsonl: string): Promise<number> {
	if (jsonl.trim() === "") return 0;

	const results = await client.collections(name).documents().import(jsonl, { action: "create" });
	const lines = results.split("\n").filter(Boolean);
	const failures = lines
		.map((line) => {
			return JSON.parse(line) as { success: boolean } | ImportResponseFail;
		})
		.filter((result): result is ImportResponseFail => {
			return !result.success;
		});

	if (failures.length > 0) {
		throw new Error(
			`Failed to import ${String(failures.length)} of ${String(lines.length)} documents into ${name}:\n${failures
				.slice(0, 10)
				.map((failure) => {
					return `  ${failure.error}`;
				})
				.join("\n")}`,
		);
	}

	return lines.length;
}

async function ensureSearchKey(client: Client): Promise<void> {
	const value = env.NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY;
	if (value == null) {
		console.warn("  ⚠ `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY` is not set, no search key created.");
		return;
	}

	const { keys } = await client.keys().retrieve();
	const existing = keys.find((key) => {
		return value.startsWith(key.value_prefix ?? "\0");
	});
	if (existing != null) {
		await client.keys(existing.id).delete();
	}

	await client.keys().create({
		value,
		description: "Local search-only key (created by `typesense:local:seed`).",
		actions: ["documents:search", "documents:get", "documents:export", "collections:get"],
		collections: [`${env.NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX}.*`],
	});
	console.warn("  ✓ search-only key from `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY`");
}

async function main(): Promise<void> {
	const source = createSourceClient();
	const target = createTargetClient();

	console.warn(
		`Seeding ${env.NEXT_PUBLIC_TYPESENSE_PROTOCOL}://${env.NEXT_PUBLIC_TYPESENSE_HOST}:${String(env.NEXT_PUBLIC_TYPESENSE_PORT)} from https://${seedHost}`,
	);

	const schemas = await retrieveSchemas(
		source,
		env.NEXT_PUBLIC_TYPESENSE_COLLECTIONS.map(physicalCollectionName),
	);

	const existing: Array<string> = [];
	for (const { name } of schemas) {
		if (await target.collections(name).exists()) existing.push(name);
	}

	if (existing.length > 0) {
		if (!shouldRecreate) {
			throw new Error(
				`Collection(s) already exist locally: ${existing.join(", ")}. Re-run with --recreate to drop and re-create them.`,
			);
		}

		/** Referencing collections must be dropped before the collections they reference. */
		for (const { name } of [...schemas].reverse()) {
			if (existing.includes(name)) {
				await target.collections(name).delete();
				console.warn(`  🗑 dropped ${name}`);
			}
		}
	}

	for (const schema of schemas) {
		await target.collections().create(toCreateSchema(schema));
		const jsonl = await source.collections(schema.name).documents().export();
		const count = await importDocuments(target, schema.name, jsonl);
		console.warn(`  ✓ ${schema.name} (${String(count)} documents)`);
	}

	await ensureSearchKey(target);

	console.warn(`\n✓ Seeded ${String(schemas.length)} collections.`);
}

await main();
