import { warn } from "../../runtime/log.js";
import type { Store } from "../../types/index.js";
import registerStateAttribute from "./register-state-attribute.js";
import { attributeToStateKey, stateKeyToAttribute } from "./state-attribute.js";

/**
 * HTML lowercases attribute names, so `data-state--userName` arrives as
 * `data-state--username` and can never match a `userName` module signal.
 */
const warnOnCaseMismatch = (
	store: Store,
	key: string,
	attributeName: string,
) => {
	if (store.state[key]) return;
	const match = Object.keys(store.state).find(
		(stateKey) => stateKey !== key && stateKey.toLowerCase() === key,
	);
	if (!match) return;
	warn(
		`The "${attributeName}" attribute on store "${store.key}" does not match the "${match}" state. Use "${stateKeyToAttribute(match)}" instead.`,
	);
};

const syncStateAttributes = (store: Store) => {
	for (const attribute of Array.from(store.element.attributes)) {
		const key = attributeToStateKey(attribute.name);
		if (!key) continue;
		warnOnCaseMismatch(store, key, attribute.name);
		registerStateAttribute(store, key, attribute.value);
	}
};

export default syncStateAttributes;
