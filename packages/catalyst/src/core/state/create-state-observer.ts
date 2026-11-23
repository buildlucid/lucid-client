import { stringifyState } from "../../helpers.js";
import { runUnowned } from "../../runtime/reactive.js";
import type { RuntimeStore } from "../../runtime/types.js";
import { attributeToStateKey, coerceStateString } from "./state-attribute.js";

/** Applies `data-state--*` attribute changes made outside Catalyst to state. */
const createStateObserver = (store: RuntimeStore) => {
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "attributes" || !mutation.attributeName) {
				continue;
			}

			const attributeName = mutation.attributeName;
			const key = attributeToStateKey(attributeName);
			if (!key || store.computed.has(key) || !(key in store.raw)) continue;

			const attributeValue = store.element.getAttribute(attributeName);
			const internalValue = store.internalStateWrites.get(attributeName);
			store.internalStateWrites.delete(attributeName);

			if (internalValue === attributeValue) continue;
			const current = store.raw[key];
			if (
				attributeValue !== null &&
				stringifyState(current) === attributeValue
			) {
				continue;
			}

			const next = coerceStateString(attributeValue, current);
			runUnowned(() =>
				store.setState((state) => {
					state[key] = next;
				}),
			);
		}
	});

	observer.observe(store.element, { attributes: true });
	return observer;
};

export default createStateObserver;
