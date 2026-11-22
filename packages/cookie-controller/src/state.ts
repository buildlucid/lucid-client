import type { Options, CookieState, Elements } from "./types.js";

const S: {
	state: CookieState;
	options: Options;
	abortController: AbortController;
	elements: Elements | null;
	opener: HTMLElement | null;
} = {
	state: {
		uuid: "",
		decided: false,
		categories: {},
	},
	options: {
		essentialCookies: false,
		categoryCookies: {},
		onConsentChange: null,
		version: null,
		storage: {
			path: "/",
			sameSite: "Strict",
		},
	},
	abortController: new AbortController(),
	elements: null,
	opener: null,
};

export default S;
