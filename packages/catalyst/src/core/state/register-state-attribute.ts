import { createEffect, createSignal } from "solid-js";
import { parseStateString, stringifyState } from "../../helpers.js";
import Catalyst from "../../runtime/catalyst.js";
import { createOwnedRoot, runEffectCallback } from "../../runtime/reactive.js";
import type { Store } from "../../types/index.js";

const registerStateAttribute = (
	store: Store,
	key: string,
	initialValue: string | null,
) => {
	if (!store.state[key]) {
		store.state[key] = createSignal<unknown>(parseStateString(initialValue));
	}

	if (store.stateAttributeDisposes.has(key)) return;

	const attributeName = `${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.state}${key}`;
	const signal = store.state[key];
	if (!signal) return;

	const dispose = createOwnedRoot((disposeRoot) => {
		createEffect(
			() => signal[0](),
			(value) =>
				runEffectCallback(() => {
					const next = stringifyState(value);
					if (store.element.getAttribute(attributeName) === next) return;

					store.internalStateWrites.set(attributeName, next);
					store.element.setAttribute(attributeName, next);
				}),
		);
		return disposeRoot;
	});

	store.stateAttributeDisposes.set(key, dispose);
};

export default registerStateAttribute;
