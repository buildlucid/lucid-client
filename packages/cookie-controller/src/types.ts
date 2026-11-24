export type StorageOptions = {
	path?: string;
	domain?: string;
	sameSite?: "Strict" | "Lax" | "None";
	secure?: boolean;
	/**
	 * When the preference cookie expires, as a number of days from the visitor's last decision or a date
	 * - Defaults to 180 days
	 * - Pass 0 for a session cookie that is removed when the browser closes
	 */
	expires?: number | Date;
};

export type Messages = {
	/** The `aria-label` of a `data-cookie--alert` element without a name. Defaults to `"Cookie consent"` */
	alert: string;
	/** The `aria-label` of a `data-cookie--details` element without a name. Defaults to `"Cookie settings"` */
	details: string;
	/** Written to `data-cookie--status` after every category is accepted. `""` writes nothing. */
	accepted: string;
	/** Written to `data-cookie--status` after every optional category is rejected */
	rejected: string;
	/** Written to `data-cookie--status` after the details checkboxes are saved */
	saved: string;
	/** Written to `data-cookie--status` after categories are updated one at a time, such as from an embed placeholder */
	updated: string;
};

export type Options = {
	/**
	 * A list of cookies that get added when a certain category is consented
	 * - Ie: analytics: ["_ga", "_gid"]
	 * - The "essential" category is always consented and always includes the cookie this library uses to store preferences
	 *
	 * Note that these are just returned in the onConsentChange callback, they are not added/removed from the users cookies
	 */
	cookies: Record<string, Array<string>>;
	/**
	 * Runs on load and after a decision is saved
	 */
	onConsentChange: ((data: ConsentChange) => void) | null;
	/**
	 * The current version of your cookie policy
	 * - Choices saved for another version are ignored, so visitors are asked again
	 */
	policyVersion: string | null;
	/**
	 * Runs on load when the visitor's saved choices are for a different policyVersion
	 */
	onPolicyVersionChange:
		| ((oldVersion: string, newVersion: string) => void)
		| null;
	/**
	 * Configure the options for the cookie used to store the user's preferences
	 */
	storage: StorageOptions;
	/**
	 * The text the library writes, for translating or rewording. A status element's own `data-cookie--message-{name}` attributes win over these.
	 */
	messages: Partial<Messages>;
};

export type ConsentChange = {
	/**
	 * The consent change type
	 * - accept: when all categories are accepted via acceptAll or an accept button
	 * - reject: when all categories are rejected via rejectAll or a reject button
	 * - save: when the details checkboxes are saved via saveDetails or a save button
	 * - update: when individual categories are updated via updateConsent or a category scoped accept/reject button
	 * - load: when the library is initialised
	 */
	type: "accept" | "reject" | "save" | "update" | "load";
	/**
	 * The users UUID
	 */
	uuid: string;
	/**
	 * The version of the cookie policy
	 */
	policyVersion?: string;
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
	 * The current version of the cookie policy. Before init, choices saved for another version are ignored. After init, the policyVersion passed to init is used instead
	 */
	policyVersion?: string;
};

export type CookieState = {
	uuid: string;
	version?: string;
	decided: boolean;
	categories: Record<string, boolean>;
};

export type Elements = {
	details: HTMLElement | null;
	alert: HTMLElement | null;
	categoryCheckboxes: NodeListOf<HTMLInputElement>;
	actionDetails: NodeListOf<Element>;
	statuses: NodeListOf<HTMLElement>;
};
