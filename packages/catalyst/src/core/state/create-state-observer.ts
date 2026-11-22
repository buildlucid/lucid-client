import { stringifyState } from "../../helpers.js";
import type { Store } from "../../types/index.js";
import { attributeToStateKey, coerceStateString } from "./state-attribute.js";

const createStateObserver = (store: Store) => {
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "attributes" || !mutation.attributeName) {
				continue;
			}

			const attributeName = mutation.attributeName;
			const key = attributeToStateKey(attributeName);
			if (!key) continue;
			const signal = store.state[key];
			if (!signal) continue;

			const attributeValue = store.element.getAttribute(attributeName);
			const internalValue = store.internalStateWrites.get(attributeName);
			store.internalStateWrites.delete(attributeName);

			if (internalValue === attributeValue) continue;
			const current = signal[0]();
			if (
				attributeValue !== null &&
				stringifyState(current) === attributeValue
			) {
				continue;
			}

			const next = coerceStateString(attributeValue, current);
			signal[1](() => next);
		}
	});

	observer.observe(store.element, { attributes: true });
	return observer;
};

export default createStateObserver;
