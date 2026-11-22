import Catalyst from "./catalyst.js";

const prefix = "[Catalyst]";

export const debug = (message: string) => {
	if (Catalyst.options.debug) console.debug(`${prefix} ${message}`);
};

export const warn = (message: string) => console.warn(`${prefix} ${message}`);

export const error = (message: string, cause: unknown) =>
	console.error(`${prefix} ${message}`, cause);
