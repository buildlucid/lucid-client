import S from "../state.js";

/**
 * Returns the consent status of a cookie via the key
 */
const getCookieConsent = (key: string) =>
	key === "essential" && S.options.essentialCookies
		? true
		: Object.hasOwn(S.state.categories, key)
			? S.state.categories[key]
			: undefined;

export default getCookieConsent;
