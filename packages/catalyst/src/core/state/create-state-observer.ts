import { stringifyState } from "../../helpers.js";
import Catalyst from "../../runtime/catalyst.js";
import { runUnowned } from "../../runtime/reactive.js";
import type { RuntimeStore } from "../../runtime/types.js";
import registerStateAttribute from "./register-state-attribute.js";
import { attributeToStateKey, coerceStateString } from "./state-attribute.js";

/** Applies a `data-state--*` attribute change made outside Catalyst to state. */
const applyAttributeChange = (store: RuntimeStore, attributeName: string) => {
	const key = attributeToStateKey(attributeName);
	if (!key || store.computed.has(key) || !(key in store.raw)) return;

	const attributeValue = store.element.getAttribute(attributeName);
	const internalValue = store.internalStateWrites.get(attributeName);
	store.internalStateWrites.delete(attributeName);

	if (internalValue === attributeValue) return;
	const current = store.raw[key];
	if (attributeValue === null || stringifyState(current) !== attributeValue) {
		const next = coerceStateString(attributeValue, current);
		runUnowned(() =>
			store.setState((state) => {
				state[key] = next;
			}),
		);
	}
	// An attribute added for declared state is kept in sync both ways from now
	// on, without waiting for a sync.
	if (attributeValue !== null) registerStateAttribute(store, key);
};

/**
 * One observer watches every store element's attributes. An element whose
 * store was destroyed may still be observed, so its changes are ignored.
 */
let observer: MutationObserver | undefined;

export const observeStateAttributes = (store: RuntimeStore) => {
	observer ??= new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "attributes" || !mutation.attributeName) continue;
			const target = mutation.target as Element;
			const current = Catalyst.storesByElement.get(target);
			if (!current || current.destroyed) continue;
			applyAttributeChange(current, mutation.attributeName);
		}
	});
	observer.observe(store.element, { attributes: true });
};

/** Stops watching every store element, when Catalyst is destroyed. */
export const disconnectStateObserver = () => {
	observer?.disconnect();
	observer = undefined;
};
