import C from "./constants.js";
import type { Options, CookieState, Elements } from "./types.js";

const S: {
	state: CookieState;
	options: Options;
	abortController: AbortController;
	elements: Elements | null;
	opener: HTMLElement | null;
	/** Set when the banner is closed without a decision. Only lasts for the current page. */
	bannerClosed: boolean;
	initialised: boolean;
	/** The attributes the library added, which destroy removes again */
	added: Array<[Element, string, string]>;
	/** Each status element's content before it was first written, so destroy can put it back */
	statusNodes: Map<HTMLElement, Node[]>;
	/** A repeated status message waiting to be written again */
	statusTimer: ReturnType<typeof setTimeout> | undefined;
	/** The warnings logged since `init`, so each is logged once */
	warnings: Set<string>;
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
		messages: {},
	},
	abortController: new AbortController(),
	elements: null,
	opener: null,
	bannerClosed: false,
	initialised: false,
	added: [],
	statusNodes: new Map(),
	statusTimer: undefined,
	warnings: new Set(),
};

export default S;
