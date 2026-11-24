import S from "../state.js";
import lib from "./index.js";

/**
 * Hides the banner for the current page without saving a decision
 * - No consent is given, and the banner shows again on the next page for undecided visitors
 */
const closeBanner = () => {
	S.bannerClosed = true;
	lib.bannerState.set(false);
};

export default closeBanner;
