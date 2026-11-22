import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/** Opens the details element with its checkboxes set to the saved choices. */
const openDetails = () => {
	if (lib.detailsState.get()) return;
	for (const element of S.elements?.categoryCheckboxes ?? []) {
		const key = element.getAttribute(C.attributes.cookieCategory);
		if (key) element.checked = lib.getConsent(key) === true;
	}
	lib.detailsState.set(true);
};

export default openDetails;
