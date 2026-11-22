import S from "../state.js";
import lib from "./index.js";

/**
 * Closes the details element without saving
 * - Unsaved checkbox edits are discarded, as the checkboxes are reset to the saved choices on open
 * - Returns undecided visitors to the alert, unless they closed it on this page
 */
const closeDetails = () => {
	lib.detailsState.set(false);
	lib.alertState.set(!S.state.decided && !S.alertClosed);
};

export default closeDetails;
