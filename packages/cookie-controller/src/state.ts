import C from "./constants.js";
import type { Options, CookieState, Elements } from "./types.js";

const S: {
	state: CookieState;
	options: Options;
	abortController: AbortController;
	elements: Elements | null;
	opener: HTMLElement | null;
	/** Set when the alert is closed without a decision. Only lasts for the current page. */
	alertClosed: boolean;
	initialised: boolean;
} = {
	state: {
		uuid: "",
		decided: false,
		categories: {},
	},
	options: {
		cookies: {},
		onConsentChange: null,
		policyVersion: null,
		onPolicyVersionChange: null,
		storage: {
			path: "/",
			sameSite: "Strict",
			expires: C.defaultExpires,
		},
	},
	abortController: new AbortController(),
	elements: null,
	opener: null,
	alertClosed: false,
	initialised: false,
};

export default S;
