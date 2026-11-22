import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/** Opens preferences with the saved choices, or closes without saving. */
const toggleDetails = () => {
	if (lib.detailsState.get()) {
		lib.dismiss();
		return;
	}
	for (const element of S.elements?.categoryCheckboxes ?? []) {
		const key = element.getAttribute(C.attributes.cookieCategory);
		if (key) element.checked = lib.getCookieConsent(key) === true;
	}
	lib.detailsState.set(true);
};

export default toggleDetails;
