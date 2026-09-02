import type { SearchOptions, SearchResponse } from "typesense";

import { physicalCollectionName } from "@/lib/typesense/collection-name";
import type { collections } from "@/lib/typesense/collections";
import type { DocumentFromSchema } from "@/lib/typesense/schema";
import {
	type CollectionName,
	type CollectionSearchParams,
	searchCollection,
	searchCollections,
} from "@/lib/typesense/search";

/**
 * The app's data access layer: one function per *shape of data a view needs*. Each one is
 * `searchCollection` plus the `include_fields` / `filter_by` join clauses that shape requires — the
 * response is passed through untouched, so what a caller gets is a plain typesense `SearchResponse`
 * whose documents carry the joined documents this query asked for.
 *
 * These are plain async functions rather than hooks, so they can be called from server components
 * (`app/[locale]/work/[id]/page.tsx`) and from client code alike; the client-side concerns —
 * loading / error state, aborting superseded requests, retry — stay in `useCollectionSearch`, which
 * can drive any of these by passing its `AbortSignal` through `options`. A hook can wrap a fetch
 * function; the reverse does not work.
 *
 * Two consequences of returning the response as it comes, both deliberate:
 *
 * - A joined key is OPTIONAL, and absent rather than
 *   empty when nothing matched. Callers read it as `document.expression ?? []`.
 * - A joined key is named after the collection it came from, not after the field pointing at it, so
 *   an expression's `translator_ids` resolve under `authors` (see `getexpression`).
 */

/* -------------------------------------------------------------------------------------------------
 * document types
 * ---------------------------------------------------------------------------------------------- */

/** A collection's document exactly as indexed — no joined documents attached. */
type DocumentOf<K extends CollectionName> = DocumentFromSchema<
	(typeof collections)[K]["collection"]
>;

export type Work = DocumentOf<"work">;
export type Person = DocumentOf<"person">;
export type Poster = DocumentOf<"poster">;
export type Group = DocumentOf<"group">;
export type Expression = DocumentOf<"expression">;
export type Performance = DocumentOf<"performance">;

/**
 * Adds the exact join projection a data-access function requests to its base document.
 *
 * The two relation parameters are deliberately separate. A forward join follows a `reference` on
 * the searched document; a reverse join is driven by `filter_by` and must use `strategy:nest_array`
 * when it is represented as an array. Callers write the concrete response shape, rather than asking
 * the generic Typesense client to infer it from an arbitrary `include_fields` string.
 */
export type DocumentWithJoins<
	Document,
	ForwardJoins extends object = object,
	ReverseJoins extends object = object,
> = Document & Partial<ForwardJoins> & Partial<ReverseJoins>;

interface JoinSpec<Document> {
	readonly clause: string;
	readonly document?: Document;
}

type JoinedDocument<Join extends JoinSpec<unknown>> =
	Join extends JoinSpec<infer Document> ? Document : never;

const translatorFields = ["id", "name"] as const;
type Translator = JoinedDocument<JoinSpec<Pick<Person, (typeof translatorFields)[number]>>>;

/** The explicitly requested relation projection returned by `getWorksWithRelations`. */
export type WorkWithRelations = DocumentWithJoins<
	Work,
	{ authors: Array<Person> },
	{
		expressions: Array<DocumentWithJoins<Expression, { translators: Array<Translator> }>>;
		performances: Array<
			DocumentWithJoins<
				Performance,
				{
					actors: Array<Person>;
					directors: Array<Person>;
					theaters: Array<Group>;
				}
			>
		>;
	}
>;

/** The explicitly requested relation projection returned by `getexpression`. */
export type ExpressionWithRelations = DocumentWithJoins<
	Expression,
	{
		work: DocumentWithJoins<Work, { performances: Array<PerformanceWithRelations> }>;
		authors: Array<Person>;
	}
>;

/** The explicitly requested relation projection returned by `getperformance`. */
export type PerformanceWithRelations = DocumentWithJoins<
	Performance,
	{
		work: Work;
		people: Array<Person>;
		posters: Array<Poster>;
		theaters: Array<Group>;
	}
>;

export type PersonWithRelations = DocumentWithJoins<
	Person,
	object,
	{
		expressions: Array<DocumentWithJoins<Expression, { work: Work }>>;
		performances: Array<Performance>;
	}
>;

/* -------------------------------------------------------------------------------------------------
 * join clauses
 * ---------------------------------------------------------------------------------------------- */

/**
 * A `$collection(...)` join clause for `include_fields`. Typesense resolves it against the
 * *physical* collection name, so the deployment prefix goes back in here; the `as <registry name>`
 * alias then keys the joined documents by the unprefixed name — the key named in this module's
 * concrete relation types.
 */
function defineJoin<
	K extends CollectionName,
	const Fields extends ReadonlyArray<keyof DocumentOf<K>>,
>(
	name: K,
	fields: Fields,
	options?: { alias?: string; strategy?: "nest_array" },
): JoinSpec<Pick<DocumentOf<K>, Fields[number]>>;
function defineJoin<K extends CollectionName>(
	name: K,
	fields: string,
	options?: { alias?: string; strategy?: "nest_array" },
): JoinSpec<DocumentOf<K>>;
function defineJoin(
	name: CollectionName,
	fields: string | ReadonlyArray<string>,
	options?: { alias?: string; strategy?: "nest_array" },
): JoinSpec<unknown> {
	const fieldList = typeof fields === "string" ? fields : fields.join(",");
	const strategySuffix = options?.strategy == null ? "" : `,strategy:${options.strategy}`;
	return {
		clause: `$${physicalCollectionName(name)}(${fieldList}${strategySuffix}) as ${options?.alias ?? name}`,
	};
}

/** A `filter_by` join clause. No alias: `filter_by` only selects documents, it names no output key. */
function joinFilterClause(name: CollectionName, filter: string): string {
	return `$${physicalCollectionName(name)}(${filter})`;
}

/**
 * A reverse join — one where the *other* collection holds the reference — is not materialised by
 * `include_fields` alone: without a matching clause in `filter_by`, typesense returns the documents
 * with nothing joined and no error. OR-ing each clause with `id:*` makes it a LEFT join, so a work
 * with no expression (or no performance) is still returned.
 */
function leftJoinFilter(names: ReadonlyArray<CollectionName>): string {
	return names
		.map((name) => {
			return `(${joinFilterClause(name, "id:*")} || id:*)`;
		})
		.join(" && ");
}

/**
 * Combines a caller's `filter_by` with the join clauses a wrapper requires. Both are parenthesised,
 * so a caller's OR-expression cannot swallow the join clauses.
 */
function withJoinFilter(filterBy: string | undefined, joinFilter: string): string {
	return filterBy == null || filterBy === "" ? joinFilter : `(${filterBy}) && (${joinFilter})`;
}

/** Quotes a Typesense string literal before embedding it in a `filter_by` expression. */
function filterString(value: string): string {
	return `\`${value.replaceAll("\\", "\\\\").replaceAll("`", "\\`")}\``;
}

/**
 * `strategy:nest_array` keeps a joined value an array whether one or several documents match —
 * typesense's default `nest` returns a bare object for a single match, a shape no static type can
 * pin down. Used for every one-to-many join below.
 */
const nestArray = "*,strategy:nest_array";

/* -------------------------------------------------------------------------------------------------
 * search params
 * ---------------------------------------------------------------------------------------------- */

/**
 * The search params a caller may pass. `include_fields` is owned by the wrapper — it is what selects
 * the joins, and overriding it would break the guarantees the return type makes. `filter_by` stays
 * open and is merged with any join filter (see `withJoinFilter`).
 */
export type DataSearchParams<K extends CollectionName> = Omit<
	CollectionSearchParams<K>,
	"include_fields" | "exclude_fields"
>;

export type WorkSearchParams = DataSearchParams<"work">;
export type ExpressionSearchParams = DataSearchParams<"expression">;
export type PerformanceSearchParams = DataSearchParams<"performance">;

/** The search parameters shared by the expression and performance item collections. */
export interface ItemSearchParams {
	q?: ExpressionSearchParams["q"];
	query_by?:
		| "title"
		| "sameas"
		| "type"
		| "work_id"
		| ReadonlyArray<"title" | "sameas" | "type" | "work_id">;
}

/* -------------------------------------------------------------------------------------------------
 * queries
 * ---------------------------------------------------------------------------------------------- */

/**
 * Works, with no joins resolved: only the reference ids (`author_ids`) are there. This is the query
 * the search and catalog views run — the cheapest one, and the only one whose document type carries
 * no joined keys at all, so a component handed a `Work` cannot read a relation that was never
 * fetched.
 */
export function getWorks(
	params: WorkSearchParams,
	options?: SearchOptions,
): Promise<SearchResponse<Work>> {
	return searchCollection("work", params, options);
}

/** Searches expressions and performances as one combined result set. */
export function getItems(params: ItemSearchParams, options?: SearchOptions) {
	return searchCollections(
		[
			{ collection: "performance", ...params },
			{ collection: "expression", ...params },
		],
		undefined,
		options,
	);
}

/** Returns one work without joins, or `null` when its Typesense document id does not exist. */
export async function getWork(id: string, options?: SearchOptions): Promise<Work | null> {
	const response = await getWorks({ filter_by: `id:=${filterString(id)}`, per_page: 1 }, options);

	return response.hits?.[0]?.document ?? null;
}

/**
 * Works with all three related collections resolved: `authors` (a forward join through
 * `author_ids`) plus the `expression` and `performance` pointing back at it (reverse joins).
 * Together these reconstitute the nested shape the single `tbo_work` collection used to have, which
 * is what `WorkResultCard` and the work detail page read.
 *
 * Costs one search regardless of how many works come back, but each hit carries its full relation
 * set — use it for views that render the relations, and `getWorks` for those that do not.
 */
export function getWorksWithRelations(
	params: WorkSearchParams,
	options?: SearchOptions,
): Promise<SearchResponse<WorkWithRelations>> {
	const includeFields = [
		defineJoin("person", nestArray, { alias: "authors" }).clause,
		defineJoin(
			"expression",
			`*,${
				defineJoin("person", translatorFields, {
					alias: "translators",
					strategy: "nest_array",
				}).clause
			},sort_by:year:asc,strategy:nest_array`,
			{ alias: "expressions" },
		).clause,
		defineJoin(
			"performance",
			`*,${defineJoin("person", nestArray, { alias: "actors" }).clause},${defineJoin("person", nestArray, { alias: "directors" }).clause},${defineJoin("group", nestArray, { alias: "theaters" }).clause},strategy:nest_array`,
			{ alias: "performances" },
		).clause,
	].join(",");

	return searchCollection<"work", WorkWithRelations>(
		"work",
		{
			...params,
			filter_by: withJoinFilter(params.filter_by, leftJoinFilter(["expression", "performance"])),
			include_fields: includeFields,
		},
		options,
	);
}

/** Returns one work with its relations, or `null` when its Typesense document id does not exist. */
export async function getWorkWithRelations(
	id: string,
	options?: SearchOptions,
): Promise<WorkWithRelations | null> {
	const response = await getWorksWithRelations(
		{ filter_by: `id:=${filterString(id)}`, per_page: 1 },
		options,
	);

	return response.hits?.[0]?.document ?? null;
}

/**
 * expression with their work and their translators resolved. Both are forward joins, so neither
 * needs a `filter_by` clause: naming the collections in `include_fields` is enough.
 *
 * The translators arrive under the key `authors`, a joined key being named after the target
 * collection and `translator_ids` pointing at `authors`. They are the expression's own translators —
 * *not* the work's authors, which are a level deeper and deliberately not fetched here.
 */
export function getExpressions(
	params: ExpressionSearchParams,
	options?: SearchOptions,
): Promise<SearchResponse<ExpressionWithRelations>> {
	const includeFields = [
		defineJoin(
			"work",
			`*,${
				defineJoin(
					"performance",
					`*,${defineJoin("poster", nestArray, { alias: "posters" }).clause},${defineJoin("group", nestArray, { alias: "theaters" }).clause},strategy:nest_array`,
					{ alias: "performances" },
				).clause
			}`,
			{ alias: "work" },
		).clause,
		defineJoin("person", nestArray, { alias: "authors" }).clause,
	].join(",");

	return searchCollection<"expression", ExpressionWithRelations>(
		"expression",
		{ ...params, include_fields: includeFields },
		options,
	);
}

export async function getExpression(
	id: string,
	options?: SearchOptions,
): Promise<ExpressionWithRelations | null> {
	const response = await getExpressions(
		{ filter_by: `id:=${filterString(id)}`, per_page: 1 },
		options,
	);

	return response.hits?.[0]?.document ?? null;
}

/**
 * performance with the work they belong to resolved. As with `getexpression`, `work` is a forward
 * join and needs no `filter_by` clause.
 */
export function getPerformances(
	params: PerformanceSearchParams,
	options?: SearchOptions,
): Promise<SearchResponse<PerformanceWithRelations>> {
	const includeFields = [
		defineJoin("work", "*").clause,
		defineJoin("person", nestArray, { alias: "people" }).clause,
		defineJoin("poster", nestArray, { alias: "posters" }).clause,
		defineJoin("group", nestArray, { alias: "theaters" }).clause,
	].join(",");

	return searchCollection<"performance", PerformanceWithRelations>(
		"performance",
		{ ...params, include_fields: includeFields },
		options,
	);
}

export async function getPerformance(
	id: string,
	options?: SearchOptions,
): Promise<PerformanceWithRelations | null> {
	const response = await getPerformances(
		{ filter_by: `id:=${filterString(id)}`, per_page: 1 },
		options,
	);

	return response.hits?.[0]?.document ?? null;
}

export type PersonSearchParams = DataSearchParams<"person">;

export function getPeople(
	params: PersonSearchParams,
	options?: SearchOptions,
): Promise<SearchResponse<PersonWithRelations>> {
	const includeFields = [
		defineJoin("expression", `*,${defineJoin("work", "*").clause},strategy:nest_array`, {
			alias: "expressions",
		}).clause,
		defineJoin("performance", nestArray, { alias: "performances" }).clause,
	].join(",");

	return searchCollection<"person", PersonWithRelations>(
		"person",
		{
			...params,
			filter_by: withJoinFilter(params.filter_by, leftJoinFilter(["expression", "performance"])),
			include_fields: includeFields,
		},
		options,
	);
}

export async function getPerson(
	id: string,
	options?: SearchOptions,
): Promise<PersonWithRelations | null> {
	const response = await getPeople({ filter_by: `id:=${filterString(id)}`, per_page: 1 }, options);

	return response.hits?.[0]?.document ?? null;
}
