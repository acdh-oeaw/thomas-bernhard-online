import type { CollectionCreateSchema, CollectionFieldSchema, SearchResponseHit } from "typesense";

type StrictFieldSchema = CollectionFieldSchema &
	({ index?: true | undefined } | { index: false; facet?: never; sort?: never });

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

type SearchableFieldType = "string" | "string[]" | "string*";

type QueryableFieldNames<T extends CollectionFieldSchema> = T extends { index: false }
	? never
	: T["name"];
type SearchableFieldNames<T extends CollectionFieldSchema> = T extends { index: false }
	? never
	: T["type"] extends SearchableFieldType
		? T["name"]
		: never;
type FilterableFieldNames<T extends CollectionFieldSchema> = T extends { index: false }
	? never
	: T["name"];
type SortableFieldNames<T extends CollectionFieldSchema> = T extends { sort: true }
	? T["name"]
	: never;
type FacetableFieldNames<T extends CollectionFieldSchema> = T extends { facet: true }
	? T["name"]
	: never;

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
			? Field["type"] extends "object[]"
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

export type CollectionDocument<C extends { fields: ReadonlyArray<CollectionFieldSchema> }> = {
	/** Every typesense document has an `id`, even though it is not part of the field schema. */
	id: string;
} & DocumentFromFields<C["fields"]>;

/** A full search hit for a collection (document + object-form `highlight`), as typed by typesense. */
export type CollectionSearchHit<C extends { fields: ReadonlyArray<CollectionFieldSchema> }> =
	SearchResponseHit<CollectionDocument<C>>;
export type CollectionQueryableFieldName<
	C extends { fields: ReadonlyArray<CollectionFieldSchema> },
> = QueryableFieldNames<C["fields"][number]>;
export type CollectionSearchableFieldName<
	C extends { fields: ReadonlyArray<CollectionFieldSchema> },
> = SearchableFieldNames<C["fields"][number]>;
export type CollectionFilterableFieldName<
	C extends { fields: ReadonlyArray<CollectionFieldSchema> },
> = FilterableFieldNames<C["fields"][number]>;
export type CollectionSortableFieldName<
	C extends { fields: ReadonlyArray<CollectionFieldSchema> },
> = SortableFieldNames<C["fields"][number]>;
export type CollectionFacetableFieldName<
	C extends { fields: ReadonlyArray<CollectionFieldSchema> },
> = FacetableFieldNames<C["fields"][number]>;

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
