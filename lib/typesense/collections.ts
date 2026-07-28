import { defineCollection } from "@/lib/typesense/schema";

export const tbo_workCollection = defineCollection({
	fields: [
		{ name: "authors.id", type: "string[]", optional: true },
		{ name: "performances.id", type: "string[]", optional: true },
		{ name: "expressions.title", type: "string[]", optional: true },
		{ name: "performances.label", type: "string[]", optional: true },
		{ name: "expressions.id", type: "string[]", optional: true },
		{ name: "expressions.language", type: "string[]", optional: true },
		{ name: "authors.name", type: "string[]", optional: true },
		{ name: "sameas", type: "string[]" },
		{ name: "performances", type: "object[]", optional: true },
		{ name: "performances.id", type: "string[]", optional: true },
		{ name: "performances.label", type: "string[]", optional: true },
		{ name: "authors", type: "object[]", optional: true },
		{ name: "authors.name", type: "string[]", optional: true },
		{ name: "authors.id", type: "string[]", optional: true },
		{ name: "expressions", type: "object[]", optional: true },
		{ name: "expressions.language", type: "string[]", optional: true },
		{ name: "expressions.title", type: "string[]", optional: true },
		{ name: "expressions.id", type: "string[]", optional: true },
		{ name: "category", type: "string", optional: true, facet: true },
		{ name: "title", type: "string", sort: true },
	] as const,
});

export const tbo_workQueryableFieldNames = [
	"sameas",
	"performances",
	"authors",
	"expressions",
	"category",
	"title",
] as const;
export const tbo_workSearchableFieldNames = [
	"authors.id",
	"performances.id",
	"expressions.title",
	"performances.label",
	"expressions.id",
	"expressions.language",
	"authors.name",
	"sameas",
	"category",
	"title",
] as const;
export const tbo_workFilterableFieldNames = [
	"authors.id",
	"performances.id",
	"expressions.title",
	"performances.label",
	"expressions.id",
	"expressions.language",
	"authors.name",
	"sameas",
	"performances",
	"performances.id",
	"performances.label",
	"authors",
	"authors.name",
	"authors.id",
	"expressions",
	"expressions.language",
	"expressions.title",
	"expressions.id",
	"category",
	"title",
] as const;
export const tbo_workSortableFieldNames = ["title"] as const;
export const tbo_workFacetableFieldNames = ["category"] as const;
