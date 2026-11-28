import { HttpError } from "@acdh-oeaw/lib";

export { HttpError };

export function isHttpError(error: unknown): error is HttpError {
	return error instanceof HttpError;
}
