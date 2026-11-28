import { env } from "#/config/env.config.ts";

/**
 * The physical typesense collection for a registry name.
 *
 * The collection registry (and everything typed off it — `CollectionName`, the join keys, the
 * generated `collections.ts`) uses **unprefixed** names: `work`, `translations`, `performances`.
 * The server hosts them under `NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX` plus that name (`tbo_work`
 * for prefix `tbo_`), so one typesense instance can carry several projects or deployments without
 * their collections colliding.
 *
 * This function is the single place that bridges the two, and it should be applied only where a
 * name is handed to typesense itself — a collection path, or a `$collection(...)` join clause in
 * `filter_by` / `include_fields`. Everywhere else the unprefixed name is the one to pass around.
 */
export function physicalCollectionName(name: string): string {
	return `${env.NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX}${name}`;
}
