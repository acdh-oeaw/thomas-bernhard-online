import type {
	SearchOptions,
	SearchResponse,
	SearchResponseHit,
	SearchResponseRequestParams,
} from "typesense";

import { physicalCollectionName } from "@/lib/typesense/collection-name";
import { collections } from "@/lib/typesense/collections";
import type { DocumentFromSchema } from "@/lib/typesense/schema";
import {
	type CollectionName,
	type CollectionSearchParams,
	searchCollection,
	searchCollectionsUnchecked,
	searchCollectionUnchecked,
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
export type Group = DocumentOf<"group">;
export type Expression = DocumentOf<"translation">;
export type Performance = DocumentOf<"event">;
export type Manifestation = DocumentOf<"publication">;

/** UI entity names remain stable across API collection renames. */
export const itemCollections = {
	work: "work",
	expression: "translation",
	manifestation: "publication",
	performance: "event",
	person: "person",
	group: "group",
} as const satisfies Record<string, CollectionName>;
export type ItemType = keyof typeof itemCollections;

interface ItemDocuments {
	work: WorkWithRelations;
	expression: ExpressionWithRelations;
	person: Person;
	manifestation: PublicationSearchDocument;
	performance: Performance;
	group: Group;
}

/** The union query adds its own discriminator from Typesense's collection metadata. */
export type UniversalSearchDocument = {
	[K in ItemType]: Omit<ItemDocuments[K], "type"> & { type: K };
}[ItemType];
export type UniversalSearchHit = {
	[K in ItemType]: SearchResponseHit<Extract<UniversalSearchDocument, { type: K }>>;
}[ItemType];

export interface UniversalSearchResponse {
	readonly hits: ReadonlyArray<UniversalSearchHit>;
	readonly found: number;
	readonly page: number;
	readonly request_params: { readonly per_page?: number };
}

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
	object,
	{
		expressions: Array<DocumentWithJoins<Expression, { translators: Array<Translator> }>>;
		performances: Array<
			DocumentWithJoins<
				Performance,
				{
					location: Group;
				}
			>
		>;
	}
>;

/** The explicitly requested relation projection returned by `getexpression`. */
export type ExpressionWithRelations = DocumentWithJoins<
	Expression,
	{
		work: DocumentWithJoins<Work, object, { performances: Array<PerformanceWithRelations> }>;
		authors: Array<Person>;
	},
	{ manifestations: Array<Manifestation> }
>;

/** Publications with the translations referenced by their `translations` field. */
export type ManifestationWithRelations = DocumentWithJoins<
	Manifestation,
	{
		expressions: Array<
			DocumentWithJoins<Expression, { work: Pick<Work, "id" | "title" | "year"> }>
		>;
	}
>;

/** Publication cards need translation titles and their original work's title and year. */
export type PublicationSearchDocument = DocumentWithJoins<
	Manifestation,
	{
		expressions: Array<
			DocumentWithJoins<
				Pick<Expression, "id" | "title">,
				{ work: Pick<Work, "id" | "title" | "year"> }
			>
		>;
	}
>;

/** The explicitly requested relation projection returned by `getperformance`. */
export type PerformanceWithRelations = DocumentWithJoins<
	Performance,
	{
		work: Work;
		location: Group;
	}
>;

export type PersonWithRelations = DocumentWithJoins<
	Person,
	object,
	{
		expressions: Array<DocumentWithJoins<Expression, { work: Work }>>;
	}
>;

export type GroupWithRelations = DocumentWithJoins<
	Group,
	object,
	{
		performances: Array<PerformanceWithRelations>;
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
export type ExpressionSearchParams = DataSearchParams<"translation">;
export type PerformanceSearchParams = DataSearchParams<"event">;
export type GroupSearchParams = DataSearchParams<"group">;

/** The search parameters shared by the universal-search collections. */
export interface ItemSearchParams {
	q?: string;
	types?: ReadonlyArray<
		"work" | "person" | "group" | "expression" | "manifestation" | "performance"
	>;
	workFilterBy?: string;
	expressionFilterBy?: string;
	page?: number;
	perPage?: number;
	sortBy?: string | ReadonlyArray<string>;
}

/* -------------------------------------------------------------------------------------------------
 * queries
 * ---------------------------------------------------------------------------------------------- */

/**
 * Works, with no joins resolved. This is the query
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

const expressionIncludeFields = [
	defineJoin(
		"work",
		`*,${
			defineJoin(
				"event",
				`*,${defineJoin("group", "*", { alias: "location" }).clause},strategy:nest_array`,
				{ alias: "performances" },
			).clause
		}`,
		{ alias: "work" },
	).clause,
	defineJoin("person", nestArray, { alias: "authors" }).clause,
	defineJoin("publication", nestArray, { alias: "manifestations" }).clause,
].join(",");

const expressionJoinFilter = `${leftJoinFilter(["publication"])} && (${joinFilterClause("work", leftJoinFilter(["event"]))} || id:*)`;

const publicationWorkJoin = defineJoin("work", ["id", "title", "year"]).clause;
const publicationTranslationTitles = defineJoin("translation", `id,title,${publicationWorkJoin}`, {
	alias: "expressions",
	strategy: "nest_array",
}).clause;

/** Builds the same collection queries for both results and facet counts. */
function getItemSearches(params: ItemSearchParams) {
	const selectedTypes = new Set(
		params.types == null || params.types.length === 0
			? ["work", "person", "group", "expression", "manifestation", "performance"]
			: params.types,
	);
	const workSearch = {
		collection: "work" as const,
		q: params.q,
		query_by: ["title", "sameas", "category"],
		highlight_full_fields: ["title"],
		...(params.workFilterBy != null ? { filter_by: params.workFilterBy } : {}),
	};
	const expressionSearch = {
		collection: "translation" as const,
		q: params.q,
		query_by: ["title", "sameas", "language", "type"],
		highlight_full_fields: ["title"],
		include_fields: expressionIncludeFields,
		filter_by: withJoinFilter(params.expressionFilterBy, expressionJoinFilter),
	};
	const manifestationSearch = {
		collection: "publication" as const,
		q: params.q,
		include_fields: publicationTranslationTitles,
		query_by: [
			"title",
			"subtitle",
			"other_title_information",
			"language",
			"sameas",
			"publisher.name",
			"tbit_shelfmark",
		],
		highlight_full_fields: ["title"],
	};
	const performanceSearch = {
		collection: "event" as const,
		q: params.q,
		query_by: ["title", "sameas", "type", "date_range", "participant_ids.name"],
		highlight_full_fields: ["title"],
	};
	const personSearch = {
		collection: "person" as const,
		q: params.q,
		query_by: ["name", "sameas"],
		highlight_full_fields: ["name"],
	};

	const groupSearch = {
		collection: "group" as const,
		q: params.q,
		query_by: ["name", "sameas"],
		highlight_full_fields: ["name"],
	};

	const searches = [
		["work", workSearch],
		["expression", expressionSearch],
		["person", personSearch],
		["group", groupSearch],
		["manifestation", manifestationSearch],
		["performance", performanceSearch],
	] as const;
	return searches
		.filter(([type]) => {
			return selectedTypes.has(type);
		})
		.map(([, search]) => {
			return search;
		});
}

/** Searches works, persons, groups, translations, publications, and performances as one combined result set. */
export async function getItems(
	params: ItemSearchParams,
	options?: SearchOptions,
): Promise<UniversalSearchResponse> {
	const selectedTypes = new Set(
		params.types == null || params.types.length === 0
			? ["work", "person", "group", "expression", "manifestation", "performance"]
			: params.types,
	);
	const commonParams = {
		...(params.page != null ? { page: params.page } : {}),
		...(params.perPage != null ? { per_page: params.perPage } : {}),
		...(params.sortBy != null
			? { sort_by: typeof params.sortBy === "string" ? params.sortBy : [...params.sortBy] }
			: {}),
	};
	const selectedSearches = getItemSearches(params);

	if (selectedTypes.size === 0) {
		return {
			hits: [],
			found: 0,
			page: params.page ?? 1,
			request_params: params.perPage == null ? {} : { per_page: params.perPage },
		};
	}

	const searchesIncludeNames = selectedTypes.has("person") || selectedTypes.has("group");
	const searchParams = searchesIncludeNames
		? { page: commonParams.page, per_page: commonParams.per_page }
		: commonParams;
	// Publications and performances have timestamp dates instead of a year field.
	// Avoid sending an unsupported shared year sort to these collections.
	if (
		(selectedTypes.has("manifestation") || selectedTypes.has("performance")) &&
		"sort_by" in searchParams
	) {
		const sort = searchParams.sort_by;
		const clauses = typeof sort === "string" ? sort.split(",") : sort;
		searchParams.sort_by = clauses?.filter((clause) => {
			return !clause.startsWith("year:");
		});
	}
	const response = await searchCollectionsUnchecked(selectedSearches, searchParams, options);
	const unionRequestParams = response.union_request_params as
		| ReadonlyArray<SearchResponseRequestParams>
		| undefined;

	return {
		// Union metadata identifies records even when their indexed document has no type.
		hits: (response.hits ?? []).map((hit) => {
			const metadata = hit as typeof hit & { collection?: string; search_index?: number };
			const origin =
				selectedSearches.find((search) => {
					return physicalCollectionName(search.collection) === metadata.collection;
				}) ?? (metadata.search_index == null ? undefined : selectedSearches[metadata.search_index]);
			return origin == null
				? hit
				: {
						...hit,
						document: {
							...hit.document,
							type: Object.entries(itemCollections).find(([, collection]) => {
								return collection === origin.collection;
							})![0],
						},
					};
		}) as unknown as ReadonlyArray<UniversalSearchHit>,
		found: response.found,
		page: response.page,
		request_params: unionRequestParams?.[0] ?? {
			...(params.perPage != null ? { per_page: params.perPage } : {}),
		},
	};
}

/** Counts only facets supported by the selected result collections, using their exact queries. */
export async function getItemFacetCounts(
	params: ItemSearchParams,
	fields: ReadonlyArray<{ name: string; query: string }>,
	options?: SearchOptions,
): Promise<Record<string, Array<{ value: string; count: number }>>> {
	const totals = new Map(
		fields.map((field) => {
			return [field.name, new Map<string, number>()];
		}),
	);
	const responses = await Promise.all(
		getItemSearches(params).map(async (search) => {
			const supported = fields.filter((field) => {
				return (
					collections[search.collection].facetableFieldNames as ReadonlyArray<string>
				).includes(field.name);
			});
			if (supported.length === 0) return null;
			// Facet queries use the same q, query_by, and filter_by as the corresponding union branch.
			const {
				collection,
				include_fields: _includeFields,
				highlight_full_fields: _highlightFields,
				...query
			} = {
				include_fields: undefined,
				...search,
			};
			return searchCollectionUnchecked(
				collection,
				{
					...query,
					q: params.q === "" ? "*" : (params.q ?? "*"),
					facet_by: supported.map((field) => {
						return field.query;
					}),
					per_page: 0,
				},
				options,
			);
		}),
	);
	for (const response of responses) {
		for (const facet of response?.facet_counts ?? []) {
			const field = fields.find((field) => {
				return field.name === facet.field_name || field.query === facet.field_name;
			});
			if (field == null) continue;
			const counts = totals.get(field.name)!;
			for (const count of facet.counts) {
				counts.set(count.value, (counts.get(count.value) ?? 0) + count.count);
			}
		}
	}
	return Object.fromEntries(
		[...totals].map(([field, counts]) => {
			return [
				field,
				[...counts]
					.map(([value, count]) => {
						return { value, count };
					})
					.sort((a, b) => {
						return b.count - a.count || a.value.localeCompare(b.value);
					}),
			];
		}),
	);
}

/** Returns one work without joins, or `null` when its Typesense document id does not exist. */
export async function getWork(id: string, options?: SearchOptions): Promise<Work | null> {
	const response = await getWorks({ filter_by: `id:=${filterString(id)}`, per_page: 1 }, options);

	return response.hits?.[0]?.document ?? null;
}

/** Works with their translations and events resolved through reverse joins. */
export function getWorksWithRelations(
	params: WorkSearchParams,
	options?: SearchOptions,
): Promise<SearchResponse<WorkWithRelations>> {
	const includeFields = [
		defineJoin(
			"translation",
			`*,${
				defineJoin("person", translatorFields, {
					alias: "translators",
					strategy: "nest_array",
				}).clause
			},sort_by:year:asc,strategy:nest_array`,
			{ alias: "expressions" },
		).clause,
		defineJoin(
			"event",
			`*,${defineJoin("group", "*", { alias: "location" }).clause},strategy:nest_array`,
			{ alias: "performances" },
		).clause,
	].join(",");

	return searchCollection<"work", WorkWithRelations>(
		"work",
		{
			...params,
			filter_by: withJoinFilter(params.filter_by, leftJoinFilter(["translation", "event"])),
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

/** Translations with their work, translators, and reverse-joined publications resolved. */
export function getExpressions(
	params: ExpressionSearchParams,
	options?: SearchOptions,
): Promise<SearchResponse<ExpressionWithRelations>> {
	return searchCollection<"translation", ExpressionWithRelations>(
		"translation",
		{
			...params,
			filter_by: withJoinFilter(params.filter_by, expressionJoinFilter),
			include_fields: expressionIncludeFields,
		},
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
		defineJoin("group", "*", { alias: "location" }).clause,
	].join(",");

	return searchCollection<"event", PerformanceWithRelations>(
		"event",
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
		defineJoin(
			"translation",
			`*,${defineJoin("work", "*").clause},sort_by:year:asc,strategy:nest_array`,
			{
				alias: "expressions",
			},
		).clause,
	].join(",");

	return searchCollection<"person", PersonWithRelations>(
		"person",
		{
			...params,
			filter_by: withJoinFilter(params.filter_by, leftJoinFilter(["translation"])),
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

export function getGroups(
	params: GroupSearchParams,
	options?: SearchOptions,
): Promise<SearchResponse<GroupWithRelations>> {
	const includeFields = defineJoin(
		"event",
		`*,${defineJoin("work", "*").clause},strategy:nest_array`,
		{ alias: "performances" },
	).clause;

	return searchCollection<"group", GroupWithRelations>(
		"group",
		{
			...params,
			filter_by: withJoinFilter(params.filter_by, leftJoinFilter(["event"])),
			include_fields: includeFields,
		},
		options,
	);
}

export async function getGroup(
	id: string,
	options?: SearchOptions,
): Promise<GroupWithRelations | null> {
	const response = await getGroups({ filter_by: `id:=${filterString(id)}`, per_page: 1 }, options);

	return response.hits?.[0]?.document ?? null;
}

/** Returns a publication with its translations, including publications with no translations. */
export async function getManifestation(
	id: string,
	options?: SearchOptions,
): Promise<ManifestationWithRelations | null> {
	const response = await searchCollection<"publication", ManifestationWithRelations>(
		"publication",
		{
			filter_by: `id:=${filterString(id)}`,
			include_fields: `*,${defineJoin("translation", `*,${publicationWorkJoin}`, { alias: "expressions", strategy: "nest_array" }).clause}`,
			per_page: 1,
		},
		options,
	);
	return response.hits?.[0]?.document ?? null;
}
