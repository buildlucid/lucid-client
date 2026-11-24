import S from "../state.js";
import lib from "./index.js";

/**
 * Picks up links added or changed since `init`, such as after a client side navigation
 * - `visible` links that left the page are no longer watched. Rules already added stay until `destroy`
 */
const refresh = () => {
	if (!S.initialised) {
		if (__DEV__) lib.log("warn", "Call init before refreshing.");
		return;
	}
	if (!S.enabled) return;

	S.cancelScan?.();
	S.cancelScan = null;
	lib.scan();
};

export default refresh;
