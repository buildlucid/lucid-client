import C from "../constants.js";
import S from "../state.js";
import type { Options } from "../types.js";
import lib from "./index.js";

/**
 * Initialises the library
 * - Calling it again starts over
 * - Does nothing for visitors who are offline, saving data or on a slow connection
 * - Links are set up once the browser is idle, so they don't compete with the page loading
 */
const initialise = (options?: Options) => {
	lib.destroy();
	S.initialised = true;
	S.options = {
		hoverDelay: options?.hoverDelay ?? C.defaultHoverDelay,
	};

	const problem = lib.connectionProblem();
	if (problem) {
		if (__DEV__) lib.log("info", `Links aren't speculated, as ${problem}.`);
		return;
	}

	S.enabled = true;
	S.support = lib.support();
	S.abortController = new AbortController();
	// Browsers with Speculation Rules wait for intent themselves.
	if (!S.support.rules) lib.intent.register();
	S.cancelScan = lib.whenIdle(() => {
		S.cancelScan = null;
		lib.scan();
	});
};

export default initialise;
