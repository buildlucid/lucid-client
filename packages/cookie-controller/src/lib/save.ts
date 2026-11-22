import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Updates the state with the new cookie preferences
 * - Fires the onConsentChange save callback
 */
const save = () => {
	for (const element of S.elements?.categoryCheckboxes ?? []) {
		const key = element.getAttribute(C.attributes.cookieCategory);
		if (key && Object.hasOwn(S.state.categories, key)) {
			S.state.categories[key] = element.checked;
		}
	}

	lib.setCookieState({ ...S.state, decided: true });
	lib.dismiss();
	lib.onConsentChange("save");
};

export default save;
