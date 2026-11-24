import S from "../state.js";
import lib from "./index.js";

/**
 * Destroys the cookie controller instance
 * - Removes all event listeners, and the accessibility attributes the library added
 * - Puts back the content of status elements it wrote to
 * - The alert and details elements are left showing or hidden as they were
 */
const destroy = () => {
	S.abortController.abort();
	S.initialised = false;
	clearTimeout(S.statusTimer);
	S.statusTimer = undefined;
	lib.restoreAttributes();
	for (const [status, nodes] of S.statusNodes) status.replaceChildren(...nodes);
	S.statusNodes.clear();
};

export default destroy;
