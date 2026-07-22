import fs from "fs";
import path from "path";

import { env } from "@/config/env.config";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";

async function main() {
	const client = createTypesenseClient();
	const collectionName = env.NEXT_PUBLIC_TYPESENSE_COLLECTION;

	if (!collectionName) {
		throw new Error("NEXT_PUBLIC_TYPESENSE_COLLECTION environment variable is not set");
	}

	console.warn(`Fetching schema for collection: ${collectionName}`);

	try {
		const collection = await client.collections(collectionName).retrieve();

		const fields = collection.fields.map((field) => {
			const fieldDef: Record<string, unknown> = {
				name: field.name,
				type: field.type,
			};

			if (field.optional) {
				fieldDef.optional = true;
			}

			if (field.index === false) {
				fieldDef.index = false;
			}

			if (field.facet) {
				fieldDef.facet = true;
			}

			if (field.sort) {
				fieldDef.sort = true;
			}

			return fieldDef;
		});

		// Extract field names by category (mirrors schema.ts type logic)
		// Only include top-level fields (no dots) for queryable/searchable since nested fields can't be searched
		const searchableFieldTypes = ["string", "string[]", "string*"];
		const isTopLevelField = (fieldName: string) => {
			return !fieldName.includes(".");
		};
		const queryableFieldNames = collection.fields
			.filter((f) => {
				return f.index !== false && isTopLevelField(f.name);
			})
			.map((f) => {
				return f.name;
			});
		const searchableFieldNames = collection.fields
			.filter((f) => {
				return (
					f.index !== false && isTopLevelField(f.name) && searchableFieldTypes.includes(f.type)
				);
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

		const fieldLines = fields
			.map((f) => {
				return `		{ name: "${String(f.name)}", type: "${String(f.type)}"${f.optional ? ", optional: true" : ""}${f.index === false ? ", index: false" : ""}${f.facet ? ", facet: true" : ""}${f.sort ? ", sort: true" : ""} },`;
			})
			.join("\n");

		const code = `import { defineCollection } from "@/lib/typesense/schema";

export const ${collectionName}Collection = defineCollection({
	fields: [
${fieldLines}
	],
});

export const ${collectionName}QueryableFieldNames = ${JSON.stringify(queryableFieldNames, null, 2)} as const;
export const ${collectionName}SearchableFieldNames = ${JSON.stringify(searchableFieldNames, null, 2)} as const;
export const ${collectionName}FilterableFieldNames = ${JSON.stringify(filterableFieldNames, null, 2)} as const;
export const ${collectionName}SortableFieldNames = ${JSON.stringify(sortableFieldNames, null, 2)} as const;
export const ${collectionName}FacetableFieldNames = ${JSON.stringify(facetableFieldNames, null, 2)} as const;
`;

		const outputPath = path.join(process.cwd(), "lib/typesense/collections.ts");

		fs.writeFileSync(outputPath, code);
		console.warn(`✓ Schema written to ${outputPath}`);
		console.warn(`✓ Generated field metadata for ${String(fields.length)} fields`);
		console.warn(`  - Queryable: ${String(queryableFieldNames.length)}`);
		console.warn(`  - Searchable: ${String(searchableFieldNames.length)}`);
		console.warn(`  - Filterable: ${String(filterableFieldNames.length)}`);
		console.warn(`  - Sortable: ${String(sortableFieldNames.length)}`);
		console.warn(`  - Facetable: ${String(facetableFieldNames.length)}`);
	} catch (error) {
		console.error("Failed to fetch schema:", error);
		process.exit(1);
	}
}

void main();
