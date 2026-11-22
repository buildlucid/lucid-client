export default {
	key: "CookieController",
	/** Days the preference cookie lasts by default, so visitors are asked again after about 6 months */
	defaultExpires: 180,
	ids: {
		details: "cookie-details",
		alert: "cookie-alert",
	},
	attributes: {
		details: "data-cookie-details",
		alert: "data-cookie-alert",
		cookieCategory: "data-cookie-category",
		activated: "data-cookie-activated",
		scriptType: "data-type",
		action: {
			attribute: "data-cookie-action",
			value: {
				dismiss: "dismiss",
				accept: "accept",
				reject: "reject",
				details: "details",
				save: "save",
			},
		},
	},
};
