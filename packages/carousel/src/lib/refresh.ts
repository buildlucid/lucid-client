import S from "../state.js";
import lib from "./index.js";

/**
 * Picks up markup that was added, changed or removed after initialisation, such as after a client side navigation
 * - Destroys carousels whose element has left the page
 * - Re-reads the options, slides, controls and markers of the others
 * - Enhances new `data-carousel` elements
 */
const refresh = () => {
	if (!S.initialised) {
		if (__DEV__) lib.log("warn", "Call init before refreshing.");
		return;
	}
	const live = [];
	for (const [root, instance] of Array.from(S.instances)) {
		if (root.isConnected) live.push(instance);
		else instance.api.destroy();
	}
	// Every carousel puts its markup back before any reads it again, so a control moved to another carousel is left to that one.
	for (const instance of live) instance.reset();
	for (const instance of live) instance.api.refresh();
	lib.scan();
};

export default refresh;
