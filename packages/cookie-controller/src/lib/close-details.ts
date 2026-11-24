import S from "../state.js";
import lib from "./index.js";

/**
 * Closes the details element without saving
 * - Unsaved checkbox edits are discarded, as the checkboxes are reset to the saved choices on open
 * - Returns undecided visitors to the banner, unless they closed it on this page
 * - Focus goes back to the element that opened it, once the banner it may be in is showing again
 */
const closeDetails = () => {
	const open = lib.detailsState.get();
	const focused = document.activeElement;
	const hadFocus =
		focused === null ||
		focused === document.body ||
		(S.elements?.details?.contains(focused) ?? false);
	lib.detailsState.set(false);
	lib.bannerState.set(!S.state.decided && !S.bannerClosed);
	if (!open) return;
	const opener = S.opener;
	S.opener = null;
	if (hadFocus && opener && lib.isShown(opener)) opener.focus();
};

export default closeDetails;
