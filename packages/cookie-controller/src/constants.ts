import type { Messages } from "./types.js";

export default {
	key: "CookieController",
	/** Days the preference cookie lasts by default, so visitors are asked again after about 6 months */
	defaultExpires: 180,
	ids: {
		details: "cookie-details",
		alert: "cookie-alert",
	},
	/**
	 * Every attribute follows the suite's `data-{namespace}--{specifier}` grammar, with `cookie` as the namespace
	 */
	attributes: {
		details: "data-cookie--details",
		alert: "data-cookie--alert",
		status: "data-cookie--status",
		/** The prefix of an element's own messages, such as `data-cookie--message-saved` */
		message: "data-cookie--message",
		cookieCategory: "data-cookie--category",
		activated: "data-cookie--activated",
		scriptType: "data-cookie--type",
		sources: [
			["data-cookie--src", "src"],
			["data-cookie--srcset", "srcset"],
		],
		action: {
			attribute: "data-cookie--action",
			value: {
				dismiss: "dismiss",
				accept: "accept",
				reject: "reject",
				details: "details",
				save: "save",
			},
		},
	},
	/** Milliseconds a repeated status message waits after the status is cleared, so screen readers read it again */
	repeatDelay: 100,
	/** The text the library writes, in English */
	messages: {
		alert: "Cookie consent",
		details: "Cookie settings",
		accepted: "You've accepted all cookies.",
		rejected: "You've rejected optional cookies.",
		saved: "Your cookie preferences have been saved.",
		updated: "Your cookie preferences have been updated.",
	} satisfies Messages as Messages,
} as const;
