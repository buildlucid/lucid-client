export type StorageOptions = {
	path?: string;
	domain?: string;
	sameSite?: "Strict" | "Lax" | "None";
	secure?: boolean;
	expires?: number | Date;
};

export type Options = {
	/**
	 * Set to true if you have essential cookies. This will return an extra category item called "essential" in the categories array on the onConsentChange callback
	 */
	essentialCookies: boolean;
	/**
	 * A list of cookies that get added when a certain cateogry is consented
	 * - Ie: analytics: ["_ga", "_gid"]
	 *
	 * Note that these are just returned in the onConsentChange callback, they are not added/removed from the users cookies
	 */
	categoryCookies: Record<string, Array<string>>;
	/**
	 * Runs on load and after a decision is committed
	 */
	onConsentChange: ((data: ConsentChange) => void) | null;
	/**
	 * A callback that is fired whenever a user state has a different version of the cookie policy to the current version
	 */
	version: {
		/**
		 * The current version of the cookie policy
		 */
		current: string;
		/**
		 * The callback
		 */
		onNewVersion?: (oldVersion: string, newVersion: string) => void;
	} | null;
	/**
	 * Configure the options for the cookie used to store the user's preferences
	 */
	storage: StorageOptions;
};

export type ConsentChange = {
	/**
	 * The consent change type
	 * - accept: when the accept button is clicked
	 * - reject: when the reject button is clicked
	 * - save: when the save button is clicked
	 * - onload: when the library is initialised
	 */
	type: "accept" | "reject" | "save" | "onload";
	/**
	 * The users UUID
	 */
	uuid: string;
	/**
	 * The version of the cookie policy
	 */
	version?: string;
	/**
	 * All of the cookie category states
	 */
	categories: Array<{
		category: string;
		consented: boolean;
		cookies: Array<string>;
	}>;
};

export type CookieState = {
	uuid: string;
	version?: string;
	decided: boolean;
	categories: Record<string, boolean>;
};

export type Elements = {
	details: HTMLElement | null;
	alert: Element | null;
	categoryCheckboxes: NodeListOf<HTMLInputElement>;
	actionDismiss: NodeListOf<Element>;
	actionAccept: NodeListOf<Element>;
	actionReject: NodeListOf<Element>;
	actionDetails: NodeListOf<Element>;
	actionSave: NodeListOf<Element>;
};
