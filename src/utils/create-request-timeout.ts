type RequestTimeout = {
	abortController: AbortController;
	timeoutId: number;
};

export function createRequestTimeout(timeoutMs: number, timeoutMessage: string): RequestTimeout {
	const abortController = new AbortController();
	const timeoutId = window.setTimeout(() => {
		abortController.abort(new Error(timeoutMessage));
	}, Math.max(1, timeoutMs));

	return {
		abortController,
		timeoutId,
	};
}
