import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Handle rejecting or accepting
 */
const rejectAccept = (mode: "accept" | "reject" = "accept") => {
	for (const element of S.elements?.categoryCheckboxes ?? []) {
		const key = element.getAttribute(C.attributes.cookieCategory);
		if (key && Object.hasOwn(S.state.categories, key)) {
			S.state.categories[key] = mode === "accept";
		}
	}

	lib.setCookieState({ ...S.state, decided: true });
	lib.dismiss();
	lib.onConsentChange(mode);
};

export default rejectAccept;
