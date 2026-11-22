export type StorageOptions = {
	path?: string;
	domain?: string;
	sameSite?: "Strict" | "Lax" | "None";
	secure?: boolean;
	expires?: number | Date;
};

export type Options = {
	/**
	 * A list of cookies that get added when a certain category is consented
	 * - Ie: analytics: ["_ga", "_gid"]
	 * - The "essential" category is always consented and always includes the cookie this library uses to store preferences
	 *
	 * Note that these are just returned in the onConsentChange callback, they are not added/removed from the users cookies
	 */
	categoryCookies: Record<string, Array<string>>;
	/**
	 * Runs on load and after a decision is saved
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
	 * - accept: when all categories are accepted via acceptAll or an accept button
	 * - reject: when all categories are rejected via rejectAll or a reject button
	 * - save: when the details checkboxes are saved via saveDetails or a save button
	 * - update: when individual categories are updated via updateConsent or a category scoped accept/reject button
	 * - onload: when the library is initialised
	 */
	type: "accept" | "reject" | "save" | "update" | "onload";
	/**
	 * The users UUID
	 */
	uuid: string;
	/**
	 * The version of the cookie policy
	 */
	version?: string;
	/**
	 * All of the cookie category states, including the always consented "essential" category
	 */
	categories: Array<{
		category: string;
		consented: boolean;
		cookies: Array<string>;
	}>;
};

export type GetConsentOptions = {
	/**
	 * The current version of the cookie policy. Before init, choices saved for another version are ignored. After init, the version passed to init is used instead
	 */
	version?: string;
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
	actionDetails: NodeListOf<Element>;
};
