import S from "../state.js";
import type { GetConsentOptions } from "../types.js";
import readCookie, { isRecord } from "./read-cookie.js";

/**
 * Returns the saved consent for every category
 * - After init, this is the library state for the categories in the markup
 * - Before init, this is read from the cookie, so it can be used before the markup exists. Pass the current policy version to ignore choices saved for another version
 */
const getAll = (options?: GetConsentOptions): Record<string, boolean> => {
	if (S.initialised) return { ...S.state.categories, essential: true };

	const consent: Record<string, boolean> = {};
	const stored = readCookie();
	const valid =
		stored !== null &&
		stored.decided === true &&
		isRecord(stored.categories) &&
		(options?.version === undefined || stored.version === options.version);
	if (valid && isRecord(stored.categories)) {
		for (const [key, value] of Object.entries(stored.categories)) {
			if (key === "__proto__" || key === "essential") continue;
			consent[key] = value === true;
		}
	}
	consent.essential = true;
	return consent;
};

/**
 * Returns the consent for every category, keyed by category
 * - "essential" is always consented
 */
function getConsent(options?: GetConsentOptions): Record<string, boolean>;
/**
 * Returns whether a category is consented
 * - "essential" is always consented
 * - Returns undefined for unknown categories
 */
function getConsent(
	category: string,
	options?: GetConsentOptions,
): boolean | undefined;
function getConsent(
	categoryOrOptions?: string | GetConsentOptions,
	options?: GetConsentOptions,
): Record<string, boolean> | boolean | undefined {
	if (typeof categoryOrOptions !== "string") return getAll(categoryOrOptions);
	if (categoryOrOptions === "essential") return true;

	const consent = getAll(options);
	return Object.hasOwn(consent, categoryOrOptions)
		? consent[categoryOrOptions]
		: undefined;
}

export default getConsent;
