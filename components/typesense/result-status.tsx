import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface ResultStatusProps {
	startIndex: number;
	endIndex: number;
	totalCount: number;
	resultLabel: string;
	isLoading?: boolean;
}

export function ResultStatus(props: Readonly<ResultStatusProps>): ReactNode {
	const t = useTranslations("Typesense.ResultStatus");
	const { startIndex, endIndex, totalCount, resultLabel, isLoading = false } = props;

	if (isLoading) {
		return <p className="font-heading text-heading-4 text-text-weak">{t("loading")}</p>;
	}

	if (totalCount === 0) {
		return (
			<p className="font-heading text-heading-4 text-text-weak">
				{t("no-results", { resultLabel })}
			</p>
		);
	}

	return (
		<p className="font-heading text-heading-4 text-text-weak">
			{t("results", {
				startIndex: String(startIndex),
				endIndex: String(endIndex),
				totalCount: String(totalCount),
				resultLabel,
			})}
		</p>
	);
}
