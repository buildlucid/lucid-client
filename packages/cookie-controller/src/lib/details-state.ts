import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Sets the details modal state - open/close
 * - A `<dialog>` opens with `showModal()`, which moves focus into it and keeps it there
 * - Any other element gets focus itself, or on its element with `autofocus`
 * - Closing doesn't move focus. `closeDetails` gives it back to the element that opened it.
 */
const setDetailsState = (modalState: boolean) => {
	const details = S.elements?.details;
	if (!details) return;
	const wasOpen = getDetailsState();
	if (modalState && !wasOpen) {
		S.opener =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		lib.bannerState.set(false);
	}
	details.setAttribute(C.attributes.details, modalState ? "true" : "false");
	details.toggleAttribute("hidden", !modalState);
	if (details instanceof HTMLDialogElement) {
		if (modalState && !details.open) details.showModal();
		if (!modalState && details.open) details.close();
	} else if (modalState && !wasOpen) {
		(details.querySelector<HTMLElement>("[autofocus]") ?? details).focus();
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
