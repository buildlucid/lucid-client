/**
 * Runs a callback once the browser is idle, or on the next task where `requestIdleCallback` isn't supported
 * @returns A function that cancels the callback
 */
const whenIdle = (callback: () => void): (() => void) => {
	if (typeof requestIdleCallback === "function") {
		const id = requestIdleCallback(callback);
		return () => cancelIdleCallback(id);
	}
	const id = setTimeout(callback, 0);
	return () => clearTimeout(id);
};

export default whenIdle;
