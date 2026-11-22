import S from "../state.js";
import lib from "./index.js";

/** Discards any unsaved choices and returns undecided visitors to the banner. */
const dismiss = () => {
	lib.alertState.set(!S.state.decided);
	lib.detailsState.set(false);
};

export default dismiss;
