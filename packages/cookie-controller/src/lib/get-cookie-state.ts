import C from "../constants.js";
import S from "../state.js";
import type { CookieState } from "../types.js";
import readCookie, { isRecord } from "./read-cookie.js";

/** Loads only committed choices for the current policy and the current controls. */
const getCookieState = (): { state: CookieState; previousVersion?: string } => {
	const version = S.options.version?.current;
	const state: CookieState = {
		uuid: "",
		version,
		decided: false,
		categories: {},
	};
	for (const element of S.elements?.categoryCheckboxes ?? []) {
		const key = element.getAttribute(C.attributes.cookieCategory);
		if (key && key !== "essential" && key !== "__proto__")
			state.categories[key] = false;
	}

	const stored = readCookie();
	if (!stored) return { state };
	if (version !== undefined && stored.version !== version) {
		const previousVersion =
			typeof stored.version === "string" ? stored.version : undefined;
		// Keep the ID for later decisions without applying the choices from this version.
		if (stored.decided === true && typeof stored.uuid === "string")
			state.uuid = stored.uuid;
		return { state, previousVersion };
	}
	//* Old cookies have no way to distinguish saved choices from checkbox edits.
	if (
		stored.decided !== true ||
		typeof stored.uuid !== "string" ||
		!isRecord(stored.categories)
	) {
		return { state };
	}
	for (const key of Object.keys(state.categories)) {
		state.categories[key] =
			Object.hasOwn(stored.categories, key) && stored.categories[key] === true;
	}
	return { state: { ...state, uuid: stored.uuid, decided: true } };
};

export default getCookieState;
