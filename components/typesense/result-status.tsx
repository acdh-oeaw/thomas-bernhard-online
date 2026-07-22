import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface ResultStatusProps {
	startIndex: number;
	endIndex: number;
	totalCount: number;
	isLoading?: boolean;
}

export function ResultStatus(props: Readonly<ResultStatusProps>): ReactNode {
	const t = useTranslations("ResultStatus");
	const { startIndex, endIndex, totalCount, isLoading = false } = props;

	if (isLoading) {
		return <p className="font-heading text-heading-4 text-text-weak">{t("loading")}</p>;
	}

	if (totalCount === 0) {
		return <p className="font-heading text-heading-4 text-text-weak">{t("no-documents")}</p>;
	}

	return (
		<p className="font-heading text-heading-4 text-text-weak">
			{t("results", {
				startIndex: String(startIndex),
				endIndex: String(endIndex),
				totalCount: String(totalCount),
				count: totalCount,
			})}
		</p>
	);
}
