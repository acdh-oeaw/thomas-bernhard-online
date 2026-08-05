import fs from "fs";
import path from "path";
import { format, resolveConfig } from "prettier";
import type { CollectionFieldSchema } from "typesense";

import { env } from "@/config/env.config";
import { createTypesenseClient } from "@/lib/typesense/create-typesense-client";

// Collections to generate schema + field metadata for. Add further collection names here.
const collectionNames = [env.NEXT_PUBLIC_TYPESENSE_COLLECTION];

// Queryable (query_by / full-text) fields are the string-typed fields, INCLUDING nested object
// sub-fields such as `authors.name`; object fields themselves are not queryable.
const queryableFieldTypes = ["string", "string[]", "string*"];

// Scalar field types — the only ones that can hold a `const` discriminant (see `StrictFieldSchema`).
const scalarFieldTypes = ["string", "int32", "int64", "float", "bool"];

// High cap so the reported facet cardinality is accurate for anything that could plausibly be a
// discriminator. `total_values` is capped by this, so a field reporting exactly 1 is single-valued.
const maxFacetValuesForCardinality = 1000;

// Discriminator acceptance, opt-in via `--accept-discriminators`: detected single-valued facetable
// scalar fields are written as `const: <value>` markers; the rest are annotated with a comment. The
// flag may be bare (accept every detected discriminator) or carry field names to restrict which are
// accepted — e.g. `--accept-discriminators=category` (comma-separated, repeatable, or as trailing
// positional names). Cardinality is always inspected and reported regardless.
const cliArgs = process.argv.slice(2);
const acceptDiscriminators = cliArgs.some((arg) => {
	return arg === "--accept-discriminators" || arg.startsWith("--accept-discriminators=");
});
const acceptedFieldNames = new Set(
	cliArgs
		.flatMap((arg) => {
			if (arg.startsWith("--accept-discriminators=")) {
				return arg.slice("--accept-discriminators=".length).split(",");
			}
			// Trailing positional (non-flag) arguments are treated as field names too.
			return arg.startsWith("--") ? [] : [arg];
		})
		.map((name) => {
			return name.trim();
		})
		.filter(Boolean),
);
// A bare `--accept-discriminators` (no field names anywhere) accepts every detected discriminator.
const acceptAllDiscriminators = acceptDiscriminators && acceptedFieldNames.size === 0;

/** Whether a detected discriminator field should be written as a `const` (vs. annotated). */
const shouldEmitConst = (fieldName: string): boolean => {
	return acceptDiscriminators && (acceptAllDiscriminators || acceptedFieldNames.has(fieldName));
};

/** Formats a facet value as a TypeScript literal for the field's scalar `type`. */
const constLiteral = (type: string, value: string): string => {
	// String values are quoted/escaped; numeric and boolean values are emitted as bare tokens.
	return type === "string" ? JSON.stringify(value) : value;
};

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
		queryable: number;
		sortable: number;
		facetable: number;
	};
}

async function buildCollectionEntry(
	client: ReturnType<typeof createTypesenseClient>,
	collectionName: string,
): Promise<CollectionEntry> {
	const collection = await client.collections(collectionName).retrieve();

	// Facetable scalar fields are the only possible `const` discriminators. Always inspect their
	// cardinality — a field with a single distinct value across the whole collection is a usable
	// discriminant — and report it. Accepted discriminators (see `--accept-discriminators`) get a
	// `const` marker; the rest are annotated with a comment.
	const facetableScalarFields = collection.fields.filter((field) => {
		return field.facet === true && scalarFieldTypes.includes(field.type);
	});

	const constByField = new Map<string, string>();

	if (facetableScalarFields.length > 0) {
		const facetResults = await client
			.collections(collectionName)
			.documents()
			.search({
				q: "*",
				facet_by: facetableScalarFields
					.map((field) => {
						return field.name;
					})
					.join(","),
				max_facet_values: maxFacetValuesForCardinality,
				per_page: 0,
			});

		console.warn(
			`\n  Checking facetable scalar fields in ${collectionName} for potential discriminators:`,
		);
		for (const field of facetableScalarFields) {
			const facet = facetResults.facet_counts?.find((entry) => {
				return entry.field_name === field.name;
			});
			const cardinality = facet?.stats.total_values ?? facet?.counts.length ?? 0;
			const soleValue = cardinality === 1 ? facet?.counts[0]?.value : undefined;
			const literal = soleValue != null ? constLiteral(field.type, soleValue) : undefined;

			let message: string;
			if (literal == null) {
				const valueWord = cardinality === 1 ? "value" : "values";
				message = `  ➖ ${field.name} (${field.type}): ${String(cardinality)} distinct ${valueWord} — cannot be a discriminator (needs exactly 1)`;
			} else {
				constByField.set(field.name, literal);
				message = shouldEmitConst(field.name)
					? `  🎯 ${field.name} (${field.type}): 1 distinct value — accepted, writing const: ${literal}`
					: `  🎯 ${field.name} (${field.type}): 1 distinct value — potential discriminator (const would be ${literal})`;
			}
			console.warn(message);
		}

		const commentedCount = Array.from(constByField.keys()).filter((name) => {
			return !shouldEmitConst(name);
		}).length;
		if (commentedCount > 0) {
			console.warn(
				`  ${String(commentedCount)} potential discriminator(s) left as comments — pass --accept-discriminators[=field,…] to write their \`const\` markers.`,
			);
		}
	}

	// List every field in the order it will be written to collections.ts.
	console.warn(
		`\n  Fields for ${collectionName}, in the order they are written to collections.ts:`,
	);
	collection.fields.forEach((field, index) => {
		const flags = [
			field.optional === true ? "optional" : null,
			field.index === false ? "index: false" : null,
			field.facet === true ? "facet" : null,
			field.sort === true ? "sort" : null,
		].filter((flag) => {
			return flag != null;
		});
		console.warn(
			`    ${String(index + 1).padStart(2)}. ${field.name} (${field.type}${flags.length > 0 ? `, ${flags.join(", ")}` : ""})`,
		);
	});
	console.warn(
		"\n  Note: this raw field order does not drive the UI. The catalog's default result-table column",
	);
	console.warn(
		"  order comes from the queryableFieldNames list below — reorder that list by hand in the",
	);
	console.warn("  generated collections.ts to change it.");

	const fieldLines = collection.fields
		.map((field) => {
			const constValue = constByField.get(field.name);
			const accepted = constValue != null && shouldEmitConst(field.name);
			const constMarker = accepted ? `, const: ${constValue}` : "";
			// A `reference: "<collection>.<field>"` foreign key encodes a Typesense JOIN. It arrives on
			// the untyped index signature of CollectionFieldSchema, so read it defensively.
			const referenceMarker =
				typeof field.reference === "string" ? `, reference: "${field.reference}"` : "";
			const line = `				{ name: "${field.name}", type: "${field.type}"${field.optional ? ", optional: true" : ""}${field.index === false ? ", index: false" : ""}${field.facet ? ", facet: true" : ""}${field.sort ? ", sort: true" : ""}${referenceMarker}${constMarker} },`;
			// Potential discriminators that aren't being accepted are annotated so they can be
			// reviewed and added by hand.
			const discriminatorComment =
				constValue != null && !accepted
					? `				// 🎯 potential discriminator — const value would be ${constValue} (re-run with --accept-discriminators to add it)\n`
					: "";
			return `${discriminatorComment}${line}`;
		})
		.join("\n");

	// Sorted queryable field names. Typesense reports nested fields more than once, so the first
	// occurrence of each name is kept before sorting.
	const uniqueQueryableFields = Array.from(
		new Map(
			collection.fields
				.filter((f) => {
					return f.index !== false && queryableFieldTypes.includes(f.type);
				})
				.map((f) => {
					return [f.name, f] as const;
				}),
		).values(),
	);
	const queryableFieldNames = uniqueQueryableFields
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
		queryableFieldNames: ${JSON.stringify(queryableFieldNames)},
		sortableFieldNames: ${JSON.stringify(sortableFieldNames)},
		facetableFieldNames: ${JSON.stringify(facetableFieldNames)},
	},`;

	return {
		code,
		counts: {
			fields: collection.fields.length,
			queryable: queryableFieldNames.length,
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
				`\n✓ ${collectionName}: ${String(counts.fields)} fields (queryable ${String(counts.queryable)}, sortable ${String(counts.sortable)}, facetable ${String(counts.facetable)})`,
			);
		}

		const code = `import { defineCollection } from "@/lib/typesense/schema";

export const collections = {
${entries.join("\n")}
} as const;
`;

		const outputPath = path.join(process.cwd(), "lib/typesense/collections.ts");

		// Format with the project's prettier config so the generated file conforms to the same
		// formatting rules as the rest of the codebase (and re-generating produces no formatting churn).
		const prettierConfig = await resolveConfig(outputPath);
		const formatted = await format(code, { ...prettierConfig, filepath: outputPath });

		fs.writeFileSync(outputPath, formatted);
		console.warn(
			`✓ Schema for ${String(collectionNames.length)} collection(s) written to ${outputPath}`,
		);
	} catch (error) {
		console.error("Failed to fetch schema:", error);
		process.exit(1);
	}
}

void main();
