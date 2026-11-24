import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Stops speculating links
 * - Removes the speculation rules and prefetch links the library added, which cancels the speculations from rules
 * - Cancels prefetches in flight
 */
const destroy = () => {
	S.cancelScan?.();
	S.cancelScan = null;
	lib.intent.cancel();
	S.abortController.abort();
	S.observer?.disconnect();
	S.observer = null;

	for (const element of document.head.querySelectorAll(
		`[${C.attributes.generated}]`,
	)) {
		element.remove();
	}

	S.requested = new Set();
	S.logged = new Set();
	S.enabled = false;
	S.initialised = false;
};

export default destroy;
