"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

export function SearchNuqsAdapter({ children }: Readonly<{ children: ReactNode }>): ReactNode {
	return <NuqsAdapter>{children}</NuqsAdapter>;
}
