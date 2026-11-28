import createMiddleware from "next-intl/middleware";

import { routing } from "#/lib/i18n/routing.ts";

export const middleware = createMiddleware(routing);
