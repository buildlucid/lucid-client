import C from "../constants.js";
import S from "../state.js";
import type { ConsentChange } from "../types.js";
import lib from "./index.js";

/**
 * Applies a consent change
 * - Activates the consent gated scripts and media that are now consented
 * - Tells the internal listeners, then fires the onConsentChange callback
 */
const onConsentChange = (type: ConsentChange["type"]) => {
	lib.activateElements();
	for (const listener of S.listeners) listener();
	if (S.options.onConsentChange) {
		const categories = Object.entries(S.state.categories).map(
			([category, consented]) => ({
				category,
				consented,
				cookies: S.options.cookies[category] ?? [],
			}),
		);
		// The library's own preference cookie is always essential.
		categories.push({
			category: "essential",
			consented: true,
			cookies: [...new Set([C.key, ...(S.options.cookies.essential ?? [])])],
		});

		S.options.onConsentChange({
			type,
			uuid: S.state.uuid,
			policyVersion: S.state.version,
			categories: categories,
		});
	}
};

export default onConsentChange;
