import fs from "fs";
import path from "path";
import type { CollectionFieldSchema } from "typesense";

import { env } from "@/config/env.config";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";

// Collections to generate schema + field metadata for. Add further collection names here.
const collectionNames = [env.NEXT_PUBLIC_TYPESENSE_COLLECTION];

// Searchable (query_by / full-text) fields are the string-typed fields, INCLUDING nested object
// sub-fields such as `authors.name`; object fields themselves are not searchable.
const searchableFieldTypes = ["string", "string[]", "string*"];

const nestingLevel = (name: string) => {
	return (name.match(/\./g) ?? []).length;
};

// Higher score = higher priority: prefer indexed, then sortable, then non-optional fields.
const searchPriority = (field: CollectionFieldSchema) => {
	return (
		(field.index !== false ? 4 : 0) +
		(field.sort === true ? 2 : 0) +
		(field.optional !== true ? 1 : 0)
	);
};

interface CollectionEntry {
	code: string;
	counts: {
		fields: number;
		searchable: number;
		filterable: number;
		sortable: number;
		facetable: number;
	};
}

async function buildCollectionEntry(
	client: ReturnType<typeof createTypesenseClient>,
	collectionName: string,
): Promise<CollectionEntry> {
	const collection = await client.collections(collectionName).retrieve();

	const fieldLines = collection.fields
		.map((field) => {
			return `				{ name: "${field.name}", type: "${field.type}"${field.optional ? ", optional: true" : ""}${field.index === false ? ", index: false" : ""}${field.facet ? ", facet: true" : ""}${field.sort ? ", sort: true" : ""} },`;
		})
		.join("\n");

	// Sorted searchable field names. Typesense reports nested fields more than once, so the first
	// occurrence of each name is kept before sorting.
	const uniqueSearchableFields = Array.from(
		new Map(
			collection.fields
				.filter((f) => {
					return f.index !== false && searchableFieldTypes.includes(f.type);
				})
				.map((f) => {
					return [f.name, f] as const;
				}),
		).values(),
	);
	const searchableFieldNames = uniqueSearchableFields
		.sort((a, b) => {
			// Shallower fields (fewer periods) come first.
			const levelDiff = nestingLevel(a.name) - nestingLevel(b.name);
			if (levelDiff !== 0) {
				return levelDiff;
			}
			// Within a nesting level, order by the search priority heuristic.
			return searchPriority(b) - searchPriority(a);
		})
		.map((f) => {
			return f.name;
		});
	const filterableFieldNames = collection.fields
		.filter((f) => {
			return f.index !== false;
		})
		.map((f) => {
			return f.name;
		});
	const sortableFieldNames = collection.fields
		.filter((f) => {
			return f.sort === true;
		})
		.map((f) => {
			return f.name;
		});
	const facetableFieldNames = collection.fields
		.filter((f) => {
			return f.facet === true;
		})
		.map((f) => {
			return f.name;
		});

	const code = `	${collectionName}: {
		collection: defineCollection({
			fields: [
${fieldLines}
			] as const,
		}),
		searchableFieldNames: ${JSON.stringify(searchableFieldNames)},
		filterableFieldNames: ${JSON.stringify(filterableFieldNames)},
		sortableFieldNames: ${JSON.stringify(sortableFieldNames)},
		facetableFieldNames: ${JSON.stringify(facetableFieldNames)},
	},`;

	return {
		code,
		counts: {
			fields: collection.fields.length,
			searchable: searchableFieldNames.length,
			filterable: filterableFieldNames.length,
			sortable: sortableFieldNames.length,
			facetable: facetableFieldNames.length,
		},
	};
}

async function main() {
	const client = createTypesenseClient();

	try {
		const entries: Array<string> = [];
		for (const collectionName of collectionNames) {
			console.warn(`Fetching schema for collection: ${collectionName}`);
			const { code, counts } = await buildCollectionEntry(client, collectionName);
			entries.push(code);
			console.warn(
				`✓ ${collectionName}: ${String(counts.fields)} fields (searchable ${String(counts.searchable)}, filterable ${String(counts.filterable)}, sortable ${String(counts.sortable)}, facetable ${String(counts.facetable)})`,
			);
		}

		const code = `import { defineCollection } from "@/lib/typesense/schema";

export const collections = {
${entries.join("\n")}
} as const;
`;

		const outputPath = path.join(process.cwd(), "lib/typesense/collections.ts");

		fs.writeFileSync(outputPath, code);
		console.warn(
			`✓ Schema for ${String(collectionNames.length)} collection(s) written to ${outputPath}`,
		);
	} catch (error) {
		console.error("Failed to fetch schema:", error);
		process.exit(1);
	}
}

void main();
