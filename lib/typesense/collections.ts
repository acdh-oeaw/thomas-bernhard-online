import { defineCollection } from "@/lib/typesense/schema";

export const collections = {
	work: {
		collection: defineCollection({
			fields: [
				{ name: "title", type: "string", sort: true },
				{ name: "category", type: "string", optional: true, facet: true },
				{ name: "author_ids", type: "string[]", optional: true, reference: "person.id" },
				{ name: "year", type: "int32", optional: true, facet: true, sort: true },
				{ name: "sameas", type: "string[]" },
			] as const,
		}),
		queryableFieldNames: ["title", "sameas", "category", "author_ids"],
		sortableFieldNames: ["title", "year"],
		facetableFieldNames: ["category", "year"],
	},
	person: {
		collection: defineCollection({
			fields: [
				{ name: "name", type: "string", sort: true },
				{ name: "sameas", type: "string[]" },
			] as const,
		}),
		queryableFieldNames: ["name", "sameas"],
		sortableFieldNames: ["name"],
		facetableFieldNames: [],
	},
	performance: {
		collection: defineCollection({
			fields: [
				{ name: "work_id", type: "string", facet: true, reference: "work.id" },
				{ name: "title", type: "string", sort: true },
				{ name: "type", type: "string" },
				{ name: "directors", type: "object[]", optional: true, facet: true },
				{ name: "actors", type: "object[]", optional: true, facet: true },
				{
					name: "poster_ids",
					type: "string[]",
					optional: true,
					facet: true,
					reference: "poster.id",
				},
				{
					name: "theater_ids",
					type: "string[]",
					optional: true,
					facet: true,
					reference: "group.id",
				},
				{ name: "date_range_sort", type: "int64", sort: true },
				{ name: "date_range_from", type: "int64" },
				{ name: "date_range_to", type: "int64" },
				{ name: "date_range", type: "string", optional: true },
				{ name: "sameas", type: "string[]" },
				{ name: "directors.name", type: "string[]", optional: true, facet: true },
				{ name: "directors.id", type: "string[]", optional: true, facet: true },
				{ name: "actors.id", type: "string[]", optional: true, facet: true },
				{ name: "actors.name", type: "string[]", optional: true, facet: true },
			] as const,
		}),
		queryableFieldNames: [
			"title",
			"work_id",
			"type",
			"sameas",
			"poster_ids",
			"theater_ids",
			"date_range",
			"directors.name",
			"directors.id",
			"actors.id",
			"actors.name",
		],
		sortableFieldNames: ["title", "date_range_sort"],
		facetableFieldNames: [
			"work_id",
			"directors",
			"actors",
			"poster_ids",
			"theater_ids",
			"directors.name",
			"directors.id",
			"actors.id",
			"actors.name",
		],
	},
	poster: {
		collection: defineCollection({
			fields: [
				{ name: "name", type: "string", sort: true },
				{ name: "year", type: "int32", optional: true, facet: true, sort: true },
				{ name: "country", type: "string", optional: true, facet: true, sort: true },
				{ name: "sameas", type: "string[]" },
			] as const,
		}),
		queryableFieldNames: ["name", "country", "sameas"],
		sortableFieldNames: ["name", "year", "country"],
		facetableFieldNames: ["year", "country"],
	},
	group: {
		collection: defineCollection({
			fields: [
				{ name: "name", type: "string", sort: true },
				{ name: "sameas", type: "string[]" },
			] as const,
		}),
		queryableFieldNames: ["name", "sameas"],
		sortableFieldNames: ["name"],
		facetableFieldNames: [],
	},
	expression: {
		collection: defineCollection({
			fields: [
				{ name: "work_id", type: "string", facet: true, reference: "work.id" },
				{ name: "title", type: "string", sort: true },
				{ name: "language", type: "string", facet: true },
				{ name: "type", type: "string" },
				{
					name: "translator_ids",
					type: "string[]",
					optional: true,
					facet: true,
					reference: "person.id",
				},
				{ name: "year", type: "int32", optional: true, facet: true, sort: true },
				{ name: "sameas", type: "string[]" },
			] as const,
		}),
		queryableFieldNames: ["title", "work_id", "language", "type", "sameas", "translator_ids"],
		sortableFieldNames: ["title", "year"],
		facetableFieldNames: ["work_id", "language", "translator_ids", "year"],
	},
} as const;
