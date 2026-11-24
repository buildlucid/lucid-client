import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Updates the consent for individual cookie categories
 * - Unlisted categories keep their saved value, or stay off if the visitor has not decided yet
 * - Saves the decision, closes the banner, fires the onConsentChange update callback and writes the status
 * - Leaves the details modal open, updating its checkboxes for the changed categories
 */
const updateConsent = (categories: Record<string, boolean>) => {
	if (!S.initialised) {
		if (__DEV__) lib.log("warn", "Call init before updating cookie consent.");
		return;
	}

	const next = { ...S.state.categories };
	const updated: string[] = [];
	for (const [key, consented] of Object.entries(categories)) {
		if (key === "essential") {
			if (__DEV__)
				lib.log("warn", 'The "essential" category is always consented.');
			continue;
		}
		if (!Object.hasOwn(next, key)) {
			if (__DEV__)
				lib.log(
					"warn",
					`Unknown cookie category "${key}". Add a checkbox with ${C.attributes.cookieCategory}="${key}" to the details element.`,
				);
			continue;
		}
		next[key] = consented === true;
		updated.push(key);
	}
	if (updated.length === 0) return;

	lib.setCookieState({ ...S.state, categories: next, decided: true });

	for (const element of S.elements?.categoryCheckboxes ?? []) {
		const key = element.getAttribute(C.attributes.cookieCategory);
		if (key && updated.includes(key)) element.checked = next[key] === true;
	}

	lib.bannerState.set(false);
	lib.onConsentChange("update");
	lib.confirm("update");
};

export default updateConsent;
