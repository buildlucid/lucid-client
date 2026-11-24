import S from "../state.js";
import lib from "./index.js";

/**
 * Picks up markup that was added or replaced after initialisation, such as after a client side navigation
 * - Re-queries the alert, details and category checkboxes
 * - Re-applies the accessibility attributes and the alert/details visibility
 * - Activates consent gated scripts and media added since the last change
 * - Does not re-read the cookie or fire any callbacks
 */
const refresh = () => {
	if (!S.initialised) {
		if (__DEV__) lib.log("warn", "Call init before refreshing.");
		return;
	}

	const elements = lib.getElements();
	if (!elements.details) {
		if (__DEV__) lib.log("warn", "No details element has been found.");
		return;
	}
	// A replaced alert means a new page, so a visitor who closed the previous alert sees it again.
	if (elements.alert !== S.elements?.alert) S.alertClosed = false;
	S.elements = elements;

	lib.restoreAttributes();
	lib.setAttributes();
	// An open details element is the same node as before, so leave it and its focus alone.
	const detailsOpen = lib.detailsState.get();
	if (!detailsOpen) lib.detailsState.set(false);
	lib.alertState.set(!S.state.decided && !detailsOpen && !S.alertClosed);
	lib.activateElements();
};

export default refresh;
