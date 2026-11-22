import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Sets the details modal state - open/close
 */
const setDetailsState = (modalState: boolean) => {
	const details = S.elements?.details;
	if (!details) return;
	if (modalState) {
		S.opener =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		lib.alertState.set(false);
	}
	details.setAttribute(C.attributes.details, modalState ? "true" : "false");
	details.toggleAttribute("hidden", !modalState);
	lib.setAttributes("dynamic");
	if (details instanceof HTMLDialogElement) {
		if (modalState && !details.open) details.showModal();
		if (!modalState && details.open) details.close();
	}
	if (!modalState) {
		S.opener?.focus();
		S.opener = null;
	}
};

/**
 * Returns the details modal state - open/close
 */
const getDetailsState = () =>
	S.elements?.details?.getAttribute(C.attributes.details) === "true";

export default {
	get: getDetailsState,
	set: setDetailsState,
};
