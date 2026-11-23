import { createEffect, runWithOwner } from "solid-js";
import { stringifyState } from "../../helpers.js";
import { runEffectCallback } from "../../runtime/reactive.js";
import type { RuntimeStore } from "../../runtime/types.js";
import { stateKeyToAttribute } from "./state-attribute.js";

type AttributeValue = { empty: boolean; text: string };

/**
 * Writes a state value to its `data-state--*` attribute whenever it changes.
 * The value is serialised while tracking, so changing nested data, such as
 * pushing to an array, updates the attribute too. The effect belongs to the
 * store, so it lasts until the store is destroyed.
 */
const registerStateAttribute = (store: RuntimeStore, key: string) => {
	if (store.stateAttributes.has(key) || store.computed.has(key)) return;
	store.stateAttributes.add(key);

	const attributeName = stateKeyToAttribute(key);
	runWithOwner(store.owner, () => {
		createEffect(
			(): AttributeValue => {
				const value = store.raw[key];
				return {
					empty: value === null || value === undefined,
					text: stringifyState(value),
				};
			},
			(value) =>
				runEffectCallback(() => {
					const current = store.element.getAttribute(attributeName);
					// A removed attribute is not recreated just to hold an empty value.
					if (current === null && value.empty) return;
					if (current === value.text) return;
					store.internalStateWrites.set(attributeName, value.text);
					store.element.setAttribute(attributeName, value.text);
				}),
		);
	});
};

export default registerStateAttribute;
