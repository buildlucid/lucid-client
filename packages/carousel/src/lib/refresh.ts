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
		lib.log("warn", "Call init before refreshing.");
		return;
	}
	for (const [root, instance] of Array.from(S.instances)) {
		if (root.isConnected) instance.api.refresh();
		else instance.api.destroy();
	}
	lib.scan();
};

export default refresh;
