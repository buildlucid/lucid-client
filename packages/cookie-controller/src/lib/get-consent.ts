import S from "../state.js";

/**
 * Returns the consent status of a cookie category via the key
 * - "essential" is always consented
 * - Returns undefined for categories that have no checkbox in the markup
 */
const getConsent = (key: string) =>
	key === "essential"
		? true
		: Object.hasOwn(S.state.categories, key)
			? S.state.categories[key]
			: undefined;

export default getConsent;
