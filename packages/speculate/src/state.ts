import C from "./constants.js";
import type { Options, Support } from "./types.js";

const S: {
	/** Set once `init` is called, even when the connection turns speculation off */
	initialised: boolean;
	/** Off for visitors who are offline, saving data or on a slow connection */
	enabled: boolean;
	options: Required<Options>;
	support: Support;
	/** Removes the intent listeners and cancels prefetches in flight */
	abortController: AbortController;
	/** Watches `visible` links until they scroll into view */
	observer: IntersectionObserver | null;
	/** Cancels the first scan, while it waits for the browser to be idle */
	cancelScan: (() => void) | null;
	/** The link the pointer is resting on, and the timer that prefetches it */
	hover: {
		link: HTMLAnchorElement;
		timer: ReturnType<typeof setTimeout>;
	} | null;
	/** The rules and prefetches already added, so nothing is requested twice */
	requested: Set<string>;
	/** The messages logged since `init`, so each is logged once */
	logged: Set<string>;
} = {
	initialised: false,
	enabled: false,
	options: { hoverDelay: C.defaultHoverDelay },
	support: { rules: false, linkPrefetch: false },
	abortController: new AbortController(),
	observer: null,
	cancelScan: null,
	hover: null,
	requested: new Set(),
	logged: new Set(),
};

export default S;
