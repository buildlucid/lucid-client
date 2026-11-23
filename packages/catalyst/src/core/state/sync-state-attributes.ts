import { parseStateString, stringifyState } from "../../helpers.js";
import { warn } from "../../runtime/log.js";
import { runUnowned } from "../../runtime/reactive.js";
import type { RuntimeStore } from "../../runtime/types.js";
import type { StoreState } from "../../types/index.js";
import registerStateAttribute from "./register-state-attribute.js";
import {
	attributeToStateKey,
	coerceStateString,
	stateKeyToAttribute,
} from "./state-attribute.js";

/**
 * HTML lowercases attribute names, so `data-state--userName` arrives as
 * `data-state--username` and can never match a `userName` state value.
 */
export const warnOnCaseMismatch = (
	storeKey: string,
	stateKeys: Iterable<string>,
	key: string,
	attributeName: string,
) => {
	const keys = Array.from(stateKeys);
	if (keys.includes(key)) return;
	const match = keys.find(
		(stateKey) => stateKey !== key && stateKey.toLowerCase() === key,
	);
	if (!match) return;
	if (__DEV__)
		warn(
			`The "${attributeName}" attribute on store "${storeKey}" does not match the "${match}" state. Use "${stateKeyToAttribute(match)}" instead.`,
		);
};

/**
 * Builds a new store's state: the definition's values are the defaults, and a
 * matching `data-state--*` attribute sets the starting value, parsed to the
 * default's type. Attributes without a default are parsed from their text.
 */
export const readStateAttributes = (
	element: Element,
	storeKey: string,
	defaults: StoreState,
) => {
	const state: StoreState = { ...defaults };
	const keys: string[] = [];
	for (const attribute of Array.from(element.attributes)) {
		const key = attributeToStateKey(attribute.name);
		if (!key) continue;
		if (__DEV__)
			warnOnCaseMismatch(storeKey, Object.keys(defaults), key, attribute.name);
		state[key] =
			key in defaults
				? coerceStateString(attribute.value, defaults[key])
				: parseStateString(attribute.value);
		keys.push(key);
	}
	return { state, keys };
};

/**
 * Picks up `data-state--*` attributes added to an existing store's element
 * since it was created. The attribute's value is applied to the state, then
 * kept in sync with it.
 */
const syncStateAttributes = (store: RuntimeStore) => {
	for (const attribute of Array.from(store.element.attributes)) {
		const key = attributeToStateKey(attribute.name);
		if (!key || store.stateAttributeDisposes.has(key)) continue;
		if (store.computed.has(key)) continue;
		if (__DEV__)
			warnOnCaseMismatch(
				store.key,
				Object.keys(store.state),
				key,
				attribute.name,
			);

		const exists = key in store.raw;
		const current = store.raw[key];
		const next = exists
			? coerceStateString(attribute.value, current)
			: parseStateString(attribute.value);
		if (!exists || stringifyState(next) !== stringifyState(current)) {
			// A sync can run inside a reactive scope, where writes are refused.
			runUnowned(() =>
				store.setState((state) => {
					state[key] = next;
				}),
			);
		}
		registerStateAttribute(store, key);
	}
};

export default syncStateAttributes;
