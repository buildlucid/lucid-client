import { parseStateString, stringifyState } from "../../helpers.js";
import Catalyst from "../../runtime/catalyst.js";
import type { Store } from "../../types/index.js";

const createStateObserver = (store: Store) => {
	const statePrefix = `${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.state}`;

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "attributes" || !mutation.attributeName) {
				continue;
			}

			const attributeName = mutation.attributeName;
			if (!attributeName.startsWith(statePrefix)) continue;

			const key = attributeName.slice(statePrefix.length);
			const signal = store.state[key];
			if (!signal) continue;

			const attributeValue = store.element.getAttribute(attributeName);
			const internalValue = store.internalStateWrites.get(attributeName);
			store.internalStateWrites.delete(attributeName);

			if (internalValue === attributeValue) continue;
			if (stringifyState(signal[0]()) === attributeValue) continue;

			const next = parseStateString(attributeValue);
			signal[1](() => next);
		}
	});

	observer.observe(store.element, { attributes: true });

	return observer;
};

export default createStateObserver;
