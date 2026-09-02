import { env } from "@/config/env.config";

/**
 * The physical typesense collection for a registry name.
 *
 * The collection registry (and everything typed off it — `CollectionName`, the join keys, the
 * generated `collections.ts`) uses **unprefixed** names: `work`, `expressions`, `performances`. The
 * server hosts them under `NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX` + that name, so one typesense
 * instance can carry several deployments of the same schema (`tbo_test_work` alongside `tbo_work`).
 *
 * This function is the single place that bridges the two, and it should be applied only where a
 * name is handed to typesense itself — a collection path, or a `$collection(...)` join clause in
 * `filter_by` / `include_fields`. Everywhere else the unprefixed name is the one to pass around.
 */
export function physicalCollectionName(name: string): string {
	return `${env.NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX}${name}`;
}
