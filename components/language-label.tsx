"use client";

import { useLocale } from "next-intl";
import { type ReactNode, useMemo } from "react";

interface LanguageLabelProps {
	/** An ISO 639 language code (e.g. "de", "en", "ger"). */
	code: string;
	/** When true, expand the code to its localised language name; otherwise render the raw code. */
	expand?: boolean;
}

/**
 * Renders a language ISO code. By default the raw code is shown; with `expand` it is resolved to
 * its human-readable name, localised to the active UI locale (e.g. "de" → "German" in English,
 * "Deutsch" in German). Falls back to the raw code when it cannot be resolved.
 */
export function useLanguageLabel(code: string, expand = false): string {
	const locale = useLocale();

	return useMemo(() => {
		if (!expand) {
			return code;
		}

		try {
			return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
		} catch {
			return code;
		}
	}, [locale, code, expand]);
}

export function LanguageLabel(props: Readonly<LanguageLabelProps>): ReactNode {
	const { code, expand = false } = props;
	const label = useLanguageLabel(code, expand);
	return <span>{label}</span>;
}
