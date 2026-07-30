/**
 * Runs `effect` with an `AbortSignal` and returns a cleanup function that aborts it. Use it as the
 * body of a `useEffect` for data fetching, so an in-flight request is cancelled when the effect
 * re-runs (its dependencies change) or the component unmounts, preventing a slow earlier response
 * from overwriting newer state:
 *
 * ```ts
 * useEffect(() => {
 * 	return abortableEffect(async (signal) => {
 * 		const data = await fetchThing({ signal });
 * 		if (signal.aborted) return;
 * 		setState(data);
 * 	});
 * }, [dep]);
 * ```
 *
 * Because the surrounding `useEffect` stays a real `useEffect`, `react-hooks/exhaustive-deps` still
 * checks its dependency array as usual — no custom-hook registration needed. The callback should
 * bail on the resulting abort (e.g. `if (signal.aborted) return;`) rather than treating it as an
 * error.
 */
export function abortableEffect(effect: (signal: AbortSignal) => void | Promise<void>): () => void {
	const controller = new AbortController();

	void effect(controller.signal);

	return () => {
		controller.abort();
	};
}
