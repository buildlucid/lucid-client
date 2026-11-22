import S from "../state.js";
import type { ConsentChange } from "../types.js";

/**
 * A util fires the onConsentChange callback
 */
const onConsentChange = (type: ConsentChange["type"]) => {
	if (S.options.onConsentChange) {
		const categories = Object.entries(S.state.categories).map(
			([category, consented]) => ({
				category,
				consented,
				cookies: S.options.categoryCookies[category] ?? [],
			}),
		);
		if (S.options.essentialCookies) {
			categories.push({
				category: "essential",
				consented: true,
				cookies: S.options.categoryCookies.essential ?? [],
			});
		}

		S.options.onConsentChange({
			type,
			uuid: S.state.uuid,
			version: S.state.version,
			categories: categories,
		});
	}
};

export default onConsentChange;
