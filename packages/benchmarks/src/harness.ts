/** Functions a page exposes for `call` steps, such as starting the library. */
export type Harness = Record<string, (...args: never[]) => void>;

declare global {
	interface Window {
		harness?: Harness;
	}
}

/** Exposes functions to the runner. Used by benchmark pages, in the browser. */
export const defineHarness = (harness: Harness) => {
	window.harness = harness;
};
