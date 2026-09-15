# Thomas Bernhard Online

## Model

Thomas Bernhard Online allows users to browse content from a number of different collections
(published translations, performances etc), all of them related to works by Thomas Bernhard. For
navigation the website follows the general pattern of:

```
work by Thomas Bernhard [ > expression or interpretation of the work ] > concrete manifestation of the expression (with media assets)
```

While Bernhard works are the global collection-unspecific entities which hold the content of all
collections together, as soon as the (optional) expression layer is entered one is navigating inside
a specific collection. Collection-specific `work > expression > manifestation` chains are:

- `work > translation > publication`
  - the same translation might be published in multiple publications, one publication can contain
    multiple translations
- `work > performance`
- `work > event`

## Typesense configuration

The application uses Typesense for catalog, search, and joined work data. The Typesense variables
are read from the environment and validated in `config/env.config.ts`.

| Variable                                  | Required    | Meaning and usage                                                                                                                                                                                                                                              |
| ----------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_TYPESENSE_HOST`              | Yes         | Typesense host name, without the protocol or port.                                                                                                                                                                                                             |
| `NEXT_PUBLIC_TYPESENSE_PORT`              | Yes         | Integer port used by the Typesense client, for example `443`.                                                                                                                                                                                                  |
| `NEXT_PUBLIC_TYPESENSE_PROTOCOL`          | No          | `http` or `https`; defaults to `https`.                                                                                                                                                                                                                        |
| `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY`    | No          | Search-only API key used by the application client. It is optional so collection setup can run before a search key exists.                                                                                                                                     |
| `NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX` | No          | Prefix added to physical collection names. For example, `tbo_test_` plus registry name `work` addresses `tbo_test_work`. Defaults to an empty string.                                                                                                          |
| `NEXT_PUBLIC_TYPESENSE_COLLECTIONS`       | Yes         | Comma-separated, unprefixed registry names to retrieve when generating `lib/typesense/collections.ts`, for example `work,person,expression,performance`. Whitespace is trimmed.                                                                                |
| `NEXT_PUBLIC_TYPESENSE_ADMIN_KEY`         | Script only | Admin key used by `create-joined-schema.ts` when creating, deleting, and importing collections. It is read directly from `process.env` and is not part of the client-side validated configuration. Keep it out of browser-exposed environments where possible. |

The collection prefix is applied in one place, by `lib/typesense/collection-name.ts`. Source code
and the generated registry use unprefixed names; only requests sent to the Typesense server use the
physical, prefixed name. This allows several deployments to share a Typesense server without
colliding.

The local template is `.env.local.example`. A typical setup has values similar to:

```dotenv
NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX=tbo_dev_
NEXT_PUBLIC_TYPESENSE_COLLECTIONS=work,person,expression,performance,poster,group
NEXT_PUBLIC_TYPESENSE_HOST=typesense.example.org
NEXT_PUBLIC_TYPESENSE_PORT=443
NEXT_PUBLIC_TYPESENSE_PROTOCOL=https
NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY=...
```

## Schema generation and joined collections

`lib/typesense/collections.ts` is generated metadata, not the place to hand-edit a Typesense schema.
Run the generator with the development dotenv context:

```sh
pnpm run typesense:generate-schema
```

The generator in `scripts/typesense/get-schema.ts` reads the collection names from
`NEXT_PUBLIC_TYPESENSE_COLLECTIONS`, retrieves each corresponding physical collection from the
configured Typesense server, and writes `lib/typesense/collections.ts`. It records the collection
fields and the metadata needed by the typed search layer: queryable, sortable, and facetable field
names. References are converted back from physical names to registry names so joined query results
remain independent of the deployment prefix.

The generated registry currently describes the main collections (`work`, `person`, `expression`,
`performance`, `poster`, and `group`) and is consumed by `lib/typesense/schema.ts` to derive
document and field-name types. Regenerate it whenever a Typesense schema changes, or whenever the
configured collection set or collection prefix changes.

The optional joined-schema workflow is handled by `scripts/typesense/create-joined-schema.ts`:

```sh
pnpm run typesense:create-joined-schema
pnpm run typesense:create-joined-schema -- --source=tbo_work
pnpm run typesense:create-joined-schema -- --recreate
```

It exports the source work collection (by default `tbo_work`), splits nested authors, expressions,
and performances into collections, creates the required references, and imports the derived
documents. Referenced collections are created first. `--recreate` drops and recreates the target
collections, so use it only when that destructive operation is intended. The script needs the admin
key described above; the normal search key is not sufficient for collection management.

The joined-query demonstration is available with:

```sh
pnpm run typesense:demonstrate-joins
```

It exercises forward and reverse joins, including the nested work → expression → author path. The
script is diagnostic/example code and does not generate application types.

## Query wrappers

The application does not call the Typesense client directly from UI code. The layers are:

- `lib/typesense/create-typesense-client.ts` creates the configured client.
- `lib/typesense/search.ts` provides typed `searchCollection` and `searchCollectionUnchecked`
  helpers, applies shared defaults, and translates registry names to physical names.
  `searchCollections` performs a federated Typesense union search across multiple collections.
- `lib/data.ts` contains the application-facing wrappers: `getWorks`, `getWork`,
  `getWorksWithRelations`, `getWorkWithRelations`, `getExpressions`, `getExpression`,
  `getPerformances`, `getPerformance`, `getPeople`, `getPerson`, and `getItems`.

`getItems` is the cross-collection search used for a union of performances and expressions. The
relation-aware wrappers build the `include_fields` and join expressions required by the detail and
catalog views. Keep collection-specific field knowledge in these wrappers or in the typed search
layer rather than duplicating Typesense calls in components.

## Open design questions

### Cumulative facet counts

The current facet-count hook sends one search request with all active filters and asks Typesense for
all configured facets. Consequently, a facet's own selected filter is also applied when its counts
are calculated, and counts for another field do not necessarily represent the useful "what would
remain if I selected this value?" state across all active fields.

A more informative implementation would issue one facet query per field. Each query would apply the
active filters for the _other_ fields while omitting the filter for the facet being counted. The
responses would then provide cumulative counts for each possible next selection. This could be
implemented as parallel searches or as one regular Typesense multisearch request containing one
search per facet. The existing `searchCollections` helper is a federated `union: true` search and is
not the same operation; a separate typed multisearch helper would make the distinction explicit.

The trade-off is request complexity and response size versus accurate, interactive counts. A future
implementation should also decide how to handle a selected value that has a zero result, whether
facets from different collections may share one multisearch request, and whether debouncing or
short-lived caching is needed while filters change.

### Joined versus flat collections

The joined collections are useful for relation-aware queries, but they introduce more schema
coordination and more expensive joins than the original nested work collection. The project should
continue to make the source of truth and the regeneration/import workflow explicit before adding
more joined paths.

## Development

Install dependencies with `pnpm install`, then start the application with:

```sh
pnpm run dev
```

Useful checks are:

```sh
pnpm run lint:check
pnpm run types:check
pnpm run format:check
```
