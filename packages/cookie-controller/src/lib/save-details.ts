import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Saves the checkbox choices in the details element
 * - Fires the onConsentChange save callback
 * - Closes the details and alert elements
 */
const saveDetails = () => {
	for (const element of S.elements?.categoryCheckboxes ?? []) {
		const key = element.getAttribute(C.attributes.cookieCategory);
		if (key && Object.hasOwn(S.state.categories, key)) {
			S.state.categories[key] = element.checked;
		}
	}

	lib.setCookieState({ ...S.state, decided: true });
	lib.closeDetails();
	lib.onConsentChange("save");
};

export default saveDetails;
