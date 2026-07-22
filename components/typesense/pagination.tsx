"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	isLoading?: boolean;
}

export function Pagination(props: Readonly<PaginationProps>): ReactNode {
	const { currentPage, totalPages, onPageChange, isLoading = false } = props;

	if (totalPages <= 1) {
		return null;
	}

	const pages: Array<{ type: "page" | "ellipsis"; value: number }> = [];

	// Always show first page
	if (currentPage > 3) {
		pages.push({ type: "page", value: 1 });
		if (currentPage > 4) {
			pages.push({ type: "ellipsis", value: -1 });
		}
	}

	// Show pages around current page
	for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
		if (
			!pages.some((p) => {
				return p.type === "page" && p.value === i;
			})
		) {
			pages.push({ type: "page", value: i });
		}
	}

	// Always show last page
	if (currentPage < totalPages - 2) {
		if (currentPage < totalPages - 3) {
			pages.push({ type: "ellipsis", value: -2 });
		}
		pages.push({ type: "page", value: totalPages });
	}

	const handlePageChange = (page: number) => {
		onPageChange(page);
	};

	return (
		<nav
			aria-label="Search results pagination"
			className="flex items-center justify-center gap-x-2"
			role="navigation"
		>
			<button
				aria-label="Go to previous page"
				className="interactive cursor-pointer rounded-2 p-2 outline-transparent hover:hover-overlay focus-visible:focus-outline disabled:cursor-not-allowed disabled:opacity-50"
				disabled={currentPage === 1 || isLoading}
				onClick={() => {
					handlePageChange(currentPage - 1);
				}}
				type="button"
			>
				<ChevronLeftIcon aria-hidden="true" className="size-5" data-slot="icon" />
			</button>

			<div aria-label="Page numbers" className="flex gap-x-1" role="group">
				{pages.map((item) => {
					if (item.type === "ellipsis") {
						return (
							<span
								key={`ellipsis-${String(item.value)}`}
								aria-hidden="true"
								className="px-2 py-1 text-text-weak"
							>
								{"…"}
							</span>
						);
					}

					const isCurrentPage = item.value === currentPage;

					return (
						<button
							key={item.value}
							aria-current={isCurrentPage ? "page" : undefined}
							// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
							aria-label={`Go to page ${item.value}${isCurrentPage ? " (current)" : ""}`}
							className={`interactive cursor-pointer rounded-2 px-3 py-1 outline-transparent focus-visible:focus-outline disabled:cursor-not-allowed disabled:opacity-50 ${
								isCurrentPage
									? "bg-fill-brand-strong font-strong text-text-inverse-strong"
									: "hover:hover-overlay"
							}`}
							disabled={isLoading}
							onClick={() => {
								handlePageChange(item.value);
							}}
							type="button"
						>
							{item.value}
						</button>
					);
				})}
			</div>

			<button
				aria-label="Go to next page"
				className="interactive cursor-pointer rounded-2 p-2 outline-transparent hover:hover-overlay focus-visible:focus-outline disabled:cursor-not-allowed disabled:opacity-50"
				disabled={currentPage === totalPages || isLoading}
				onClick={() => {
					handlePageChange(currentPage + 1);
				}}
				type="button"
			>
				<ChevronRightIcon aria-hidden="true" className="size-5" data-slot="icon" />
			</button>
		</nav>
	);
}
