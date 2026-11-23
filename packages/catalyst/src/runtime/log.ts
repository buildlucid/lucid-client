import Catalyst from "./catalyst.js";

const prefix = "[Catalyst]";

// Warnings and debug messages only log in the development build. Call them
// inside `if (__DEV__)`, so the production build leaves out the messages too.

export const debug = (message: string) => {
	if (__DEV__ && Catalyst.options.debug) console.debug(`${prefix} ${message}`);
};

export const warn = (message: string, cause?: unknown) => {
	if (!__DEV__) return;
	if (cause === undefined) console.warn(`${prefix} ${message}`);
	else console.warn(`${prefix} ${message}`, cause);
};

/** Errors thrown by user code, such as a store's `init`, log in every build. */
export const error = (message: string, cause: unknown) =>
	console.error(`${prefix} ${message}`, cause);
