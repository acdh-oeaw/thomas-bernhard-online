import { assert } from "@acdh-oeaw/lib";
import { Client } from "typesense";

import { env } from "@/config/env.config";
import { clientConfig } from "@/config/typesense.config";

export function createTypesenseClient(): Client {
	const apiKey = env.NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY;
	assert(apiKey, "Missing `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY` environment variable.");

	return new Client({
		...clientConfig,
		apiKey,
		nodes: [
			{
				host: env.NEXT_PUBLIC_TYPESENSE_HOST,
				port: env.NEXT_PUBLIC_TYPESENSE_PORT,
				protocol: env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
			},
		],
	});
}
