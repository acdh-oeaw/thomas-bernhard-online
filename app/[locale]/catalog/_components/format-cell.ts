/** Renders an arbitrary document field value as a single display string for a table cell. */
export function formatCell(value: unknown): string {
	if (value == null) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value
			.map((item) => {
				return typeof item === "string" ? item : JSON.stringify(item);
			})
			.join(", ");
	}
	return JSON.stringify(value);
}
