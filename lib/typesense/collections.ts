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
} as const;
