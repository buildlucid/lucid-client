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
} as const;
