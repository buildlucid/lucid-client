import S from "../state.js";
import lib from "./index.js";

/**
 * Picks up markup that was added, changed or removed after initialisation, such as after a client side navigation
 * - Destroys forms whose element has left the page
 * - Reads the markup of the others again
 * - Enhances new `data-form` elements
 */
const refresh = () => {
	if (!S.initialised) {
		if (__DEV__) lib.log("warn", "Call init before refreshing.");
		return;
	}
	for (const [form, instance] of Array.from(S.instances)) {
		if (form.isConnected) instance.api.refresh();
		else instance.api.destroy();
	}
	lib.scan();
};

export default refresh;
