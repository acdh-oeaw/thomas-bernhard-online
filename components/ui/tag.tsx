import type { ReactNode } from "react";

interface TagProps {
	value: string;
	label: string;
}

/** A single, non-interactive attribute with its own pill styling. */
export function Tag(props: Readonly<TagProps>): ReactNode {
	const { value, label } = props;
	return (
		<span className="rounded-full border border-(--entity-brand-border) bg-(--entity-brand-tint) px-2 py-0.5 text-tiny text-text-strong">
			<span className="sr-only">
				{label}
				{": "}
			</span>
			{value}
		</span>
	);
}
