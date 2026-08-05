import type { CollectionCreateSchema, CollectionFieldSchema, SearchResponseHit } from "typesense";

/** Scalar field types — the only ones that can carry a `const` discriminant literal. */
type ScalarFieldType = "bool" | "float" | "int32" | "int64" | "string";

type StrictFieldSchema = CollectionFieldSchema &
	/** A `reference: "<collection>.<field>"` foreign key encodes a Typesense JOIN (see `JoinedDocuments`). */
	{ reference?: string } & (
		| { index?: true | undefined }
		| { index: false; facet?: never; sort?: never }
	) &
	/**
	 * A `const` literal may only be attached to a *scalar* field. It types that field as the exact
	 * literal in the document type (rather than the general `type`), so a field indexed with the same
	 * value across every document in a collection becomes a discriminant for narrowing a union of
	 * collection document types. Array and object fields cannot serve as discriminated-union tags, so
	 * they may not carry `const`.
	 */
	({ type: ScalarFieldType; const?: boolean | number | string } | { const?: never });

interface FieldTypeMap {
	string: string;
	"string[]": Array<string>;
	int32: number;
	int64: number;
	float: number;
	"int32[]": Array<number>;
	"int64[]": Array<number>;
	"float[]": Array<number>;
	bool: boolean;
	"bool[]": Array<boolean>;
	geopoint: [number, number];
	"geopoint[]": Array<[number, number]>;
	object: Record<string, unknown>;
	"object[]": Array<Record<string, unknown>>;
	auto: unknown;
	"string*": unknown;
	image: unknown;
	geopolygon: unknown;
}

/** Field types usable in `query_by` (full-text search); nested string sub-fields included. */
type QueryableFieldType = "string" | "string[]" | "string*";

/**
 * Typesense flattens nested object sub-fields into dot-separated schema entries: an `object[]`
 * field `authors` also declares `authors.name`, `authors.id`, etc. Rather than exposing those as
 * top-level attributes, we reconstruct the parent object's shape from them (see `FieldValue` /
 * `DocumentFromPrefix`).
 */

/** Maps an array field type to the type of a single element (for un-flattening `object[]`). */
interface ArrayElementFieldType {
	"string[]": "string";
	"int32[]": "int32";
	"int64[]": "int64";
	"float[]": "float";
	"bool[]": "bool";
	"geopoint[]": "geopoint";
	"object[]": "object";
}

/**
 * ASSUMPTION (de-array): when a scalar sub-field of an `object[]` is declared as an array (e.g.
 * `authors.id: string[]`), we treat that array-ness as an artifact of typesense flattening the
 * array of objects and collapse it to a single value per element (`id: string`). This is correct
 * when each object holds a single value for the sub-field — the common case, and how this codebase
 * reads the data (`author.name` as a string). It is WRONG for a sub-field that is genuinely
 * multi-valued *per element* (e.g. one author with several `name`s): the schema cannot distinguish
 * the two, so such a field would be under-typed here. If that case ever arises, model it explicitly
 * rather than relying on this inference.
 */
type SingularFieldType<T extends string> = T extends keyof ArrayElementFieldType
	? ArrayElementFieldType[T]
	: T;

/**
 * The local key of a field `Name` that is a *direct* child of `Prefix` (e.g. "id" for the field
 * "authors.id" under prefix "authors."). Yields `never` for the parent itself and for deeper
 * descendants such as "authors.contact.email".
 */
type DirectChildKey<
	Name extends string,
	Prefix extends string,
> = Name extends `${Prefix}${infer Rest}`
	? Rest extends ""
		? never
		: Rest extends `${string}.${string}`
			? never
			: Rest
	: never;

type RequiredChildKeys<
	Fields extends CollectionFieldSchema,
	Prefix extends string,
> = Fields extends { optional: true } ? never : DirectChildKey<Fields["name"], Prefix>;

type OptionalChildKeys<
	Fields extends CollectionFieldSchema,
	Prefix extends string,
> = Fields extends { optional: true } ? DirectChildKey<Fields["name"], Prefix> : never;

/**
 * Resolves the value type of the field named `Name`. `object`/`object[]` fields recurse into their
 * flattened sub-fields; an `object[]` becomes an array of the reconstructed record. `InArray`
 * tracks whether an ancestor was an `object[]`, in which case typesense array-flattened the scalar
 * sub-fields and we collapse one level back (`authors.id: string[]` → element `id: string`).
 */
type FieldValue<
	Fields extends CollectionFieldSchema,
	Name extends string,
	InArray extends boolean,
> =
	Extract<Fields, { name: Name }> extends infer Field
		? Field extends CollectionFieldSchema
			? Field extends { const: infer Literal extends boolean | number | string }
				? Literal
				: Field["type"] extends "object[]"
					? Array<DocumentFromPrefix<Fields, `${Name}.`, true>>
					: Field["type"] extends "object"
						? DocumentFromPrefix<Fields, `${Name}.`, InArray>
						: FieldTypeMap[InArray extends true ? SingularFieldType<Field["type"]> : Field["type"]]
			: never
		: never;

/** Builds the object type of all direct children of `Prefix` from the flattened field list. */
type DocumentFromPrefix<
	Fields extends CollectionFieldSchema,
	Prefix extends string,
	InArray extends boolean,
> = {
	[K in RequiredChildKeys<Fields, Prefix>]: FieldValue<Fields, `${Prefix}${K}`, InArray>;
} & {
	[K in OptionalChildKeys<Fields, Prefix>]?: FieldValue<Fields, `${Prefix}${K}`, InArray> | null;
};

type DocumentFromFields<F extends ReadonlyArray<CollectionFieldSchema>> = DocumentFromPrefix<
	F[number],
	"",
	false
>;

export type DocumentFromSchema<C extends { fields: ReadonlyArray<CollectionFieldSchema> }> = {
	/** Every typesense document has an `id`, even though it is not part of the field schema. */
	id: string;
} & DocumentFromFields<C["fields"]>;

/**
 * A registry of collections keyed by name — the shape of the generated `collections` object, seen
 * structurally so this stays decoupled from it. Join resolution needs the whole registry because a
 * `reference` points at a *sibling* collection, not something derivable from the owning collection's
 * own fields.
 */
type CollectionRegistry = Record<
	string,
	{ collection: { fields: ReadonlyArray<CollectionFieldSchema> } }
>;

/** The referenced collection name in a `reference` string ("tbo_person.id" → "tbo_person"). */
type ReferencedCollection<Ref extends string> = Ref extends `${infer Coll}.${string}`
	? Coll
	: never;

/** The `reference`-carrying (join) fields of collection `K`. */
type ReferenceFieldsOf<R extends CollectionRegistry, K extends keyof R> = Extract<
	R[K]["collection"]["fields"][number],
	{ reference: string }
>;

/**
 * The joined document for one reference field: the target collection's document, wrapped in an array
 * when the *local* reference field is itself an array (a one-to-many join — see the cardinality
 * caveat below). Yields `never` for a `reference` whose target isn't a known collection in `R`.
 */
type JoinedValue<R extends CollectionRegistry, F extends { reference: string; type: string }> =
	ReferencedCollection<F["reference"]> extends infer Coll extends keyof R
		? F["type"] extends `${string}[]`
			? Array<DocumentFromSchema<R[Coll]["collection"]>>
			: DocumentFromSchema<R[Coll]["collection"]>
		: never;

/**
 * The joined documents pulled in by a Typesense JOIN. For each `reference` field on collection `K`,
 * adds an **optional** property keyed by the referenced collection name, holding that collection's
 * document (or an array of them for a one-to-many join).
 *
 * Every property is optional on purpose: whether a join is actually materialised depends on the
 * runtime `include_fields` (`$tbo_person(...)`) of the individual search, which is deliberately not
 * modelled at the type level. So a joined field is `T | undefined` and callers must narrow before
 * reading it — which is exactly the runtime contract.
 *
 * CAVEATS: cardinality is inferred from the local field being an array (`string[]` → many), so the
 * reverse join direction (another collection referencing this one, always an array) is not modelled;
 * aliases (`… as author`) and `strategy: merge` flattening are not modelled (the property is always
 * keyed by the target collection name and always nested); and two references to the same collection
 * collapse onto one key. Use `searchCollectionUnchecked` where these don't hold.
 */
type JoinedDocuments<R extends CollectionRegistry, K extends keyof R> = {
	[F in ReferenceFieldsOf<R, K> as ReferencedCollection<F["reference"] & string>]?: JoinedValue<
		R,
		F & { reference: string; type: string }
	>;
};

/** A collection's document plus its (optional) joined documents. */
export type CollectionDocumentWithJoins<
	R extends CollectionRegistry,
	K extends keyof R,
> = DocumentFromSchema<R[K]["collection"]> & JoinedDocuments<R, K>;

/** A full search hit for a collection (document + object-form `highlight`), as typed by typesense. */
export type CollectionSearchHit<C extends { fields: ReadonlyArray<CollectionFieldSchema> }> =
	SearchResponseHit<DocumentFromSchema<C>>;
/** Field names usable in `query_by`: indexed `string` / `string[]` / `string*` fields. */
export type CollectionQueryableFieldName<
	C extends { fields: ReadonlyArray<CollectionFieldSchema> },
> = C["fields"][number] extends infer Field extends CollectionFieldSchema
	? Field extends { index: false }
		? never
		: Field["type"] extends QueryableFieldType
			? Field["name"]
			: never
	: never;
/** Field names flagged `sort: true`. */
export type CollectionSortableFieldName<
	C extends { fields: ReadonlyArray<CollectionFieldSchema> },
> = C["fields"][number] extends infer Field extends CollectionFieldSchema
	? Field extends { sort: true }
		? Field["name"]
		: never
	: never;
/** Field names flagged `facet: true`. */
export type CollectionFacetableFieldName<
	C extends { fields: ReadonlyArray<CollectionFieldSchema> },
> = C["fields"][number] extends infer Field extends CollectionFieldSchema
	? Field extends { facet: true }
		? Field["name"]
		: never
	: never;

export interface Collection<F extends ReadonlyArray<CollectionFieldSchema>> {
	fields: F;
	schema(name: string): CollectionCreateSchema;
}

export function defineCollection<F extends ReadonlyArray<StrictFieldSchema>>(config: {
	fields: F;
}): Collection<F> {
	return {
		fields: config.fields,
		schema(name: string): CollectionCreateSchema {
			return { name, fields: [...config.fields] };
		},
	};
}
