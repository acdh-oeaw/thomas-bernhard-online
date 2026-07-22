import type { ReactNode } from "react";

interface HighlightedSnippetProps {
	snippet: string;
}

/**
 * Renders a typesense highlight `snippet` inline. The snippet may contain `<mark>` tags around
 * matched tokens; when it has no markup it is rendered as plain text.
 */
export function HighlightedSnippet(props: Readonly<HighlightedSnippetProps>): ReactNode {
	const { snippet } = props;

	if (snippet.includes("<mark>")) {
		return (
			<span
				// eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml
				dangerouslySetInnerHTML={{ __html: snippet }}
				className="[&_mark]:bg-fill-brand-strong [&_mark]:font-strong [&_mark]:text-text-inverse-strong [&_mark]:no-underline"
			/>
		);
	}

	return snippet;
}
