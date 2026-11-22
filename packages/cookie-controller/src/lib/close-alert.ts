import S from "../state.js";
import lib from "./index.js";

/**
 * Hides the alert for the current page without saving a decision
 * - No consent is given, and the alert shows again on the next page for undecided visitors
 */
const closeAlert = () => {
	S.alertClosed = true;
	lib.alertState.set(false);
};

export default closeAlert;
