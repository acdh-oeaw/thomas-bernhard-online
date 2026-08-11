import { defineCollection } from "@/lib/typesense/schema";

export const collections = {
	tbo_work: {
		collection: defineCollection({
			fields: [
				{ name: "authors.id", type: "string[]", optional: true },
				{ name: "authors.name", type: "string[]", optional: true },
				{ name: "authors", type: "object[]", optional: true },
				{ name: "performances.id", type: "string[]", optional: true },
				{ name: "performances.label", type: "string[]", optional: true },
				{ name: "performances", type: "object[]", optional: true },
				{ name: "expressions.id", type: "string[]", optional: true },
				{ name: "expressions.title", type: "string[]", optional: true },
				{ name: "expressions.language", type: "string[]", optional: true },
				{ name: "expressions", type: "object[]", optional: true },
				{ name: "sameas", type: "string[]" },
				{ name: "category", type: "string", optional: true, facet: true },
				{ name: "title", type: "string", sort: true },
			] as const,
		}),
		queryableFieldNames: [
			"title",
			"sameas",
			"category",
			"authors.id",
			"authors.name",
			"performances.id",
			"performances.label",
			"expressions.id",
			"expressions.title",
			"expressions.language",
		],
		sortableFieldNames: ["title"],
		facetableFieldNames: ["category"],
	},
	tbo_test_work: {
		collection: defineCollection({
			fields: [
				{ name: "sameas", type: "string[]" },
				{ name: "category", type: "string", optional: true, facet: true },
				{ name: "title", type: "string", sort: true },
			] as const,
		}),
		queryableFieldNames: ["title", "sameas", "category"],
		sortableFieldNames: ["title"],
		facetableFieldNames: ["category"],
	},
	tbo_test_expressions: {
		collection: defineCollection({
			fields: [
				{ name: "work_id", type: "string", reference: "tbo_test_work.id" },
				{ name: "type", type: "string" },
				{ name: "title", type: "string", optional: true },
				{ name: "language", type: "string", optional: true },
			] as const,
		}),
		queryableFieldNames: ["work_id", "type", "title", "language"],
		sortableFieldNames: [],
		facetableFieldNames: [],
	},
	tbo_test_performances: {
		collection: defineCollection({
			fields: [
				{ name: "work_id", type: "string", reference: "tbo_test_work.id" },
				{ name: "type", type: "string" },
				{ name: "label", type: "string", optional: true },
			] as const,
		}),
		queryableFieldNames: ["work_id", "type", "label"],
		sortableFieldNames: [],
		facetableFieldNames: [],
	},
} as const;
