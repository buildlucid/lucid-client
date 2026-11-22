import { createEffect, createSignal } from "solid-js";
import { parseStateString, stringifyState } from "../../helpers.js";
import { createOwnedRoot, runEffectCallback } from "../../runtime/reactive.js";
import type { Store } from "../../types/index.js";
import { stateKeyToAttribute } from "./state-attribute.js";

const registerStateAttribute = (
	store: Store,
	key: string,
	initialValue: string | null,
) => {
	if (!store.state[key]) {
		store.state[key] = createSignal<unknown>(parseStateString(initialValue));
	}

	if (store.stateAttributeDisposes.has(key)) return;

	const attributeName = stateKeyToAttribute(key);
	const signal = store.state[key];
	if (!signal) return;

	const dispose = createOwnedRoot((disposeRoot) => {
		createEffect(
			() => signal[0](),
			(value) =>
				runEffectCallback(() => {
					const current = store.element.getAttribute(attributeName);
					// A removed attribute is not recreated just to hold an empty value.
					if (current === null && (value === null || value === undefined)) {
						return;
					}

					const next = stringifyState(value);
					if (current === next) return;
					store.internalStateWrites.set(attributeName, next);
					store.element.setAttribute(attributeName, next);
				}),
		);
		return disposeRoot;
	});

	store.stateAttributeDisposes.set(key, dispose);
};

export default registerStateAttribute;
