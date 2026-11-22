import { destroyStore } from "../core/store/index.js";
import type { SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectElements from "./collect-elements.js";
import disposeRegistration from "./dispose-registration.js";

/**
 * Walks the subtree and looks each element up, so the cost scales with the
 * size of the subtree rather than with every registration on the page.
 */
const disposeSubtree = (target: Element, options?: SyncOptions) => {
	const elements = collectElements(target, options);

	for (const element of elements) {
		const registrations = Catalyst.registrations.get(element);
		if (!registrations) continue;
		for (const registration of Array.from(registrations.values())) {
			disposeRegistration(registration);
		}
	}

	for (const element of elements) {
		const store = Catalyst.storesByElement.get(element);
		if (store) destroyStore(store);
	}
};

export default disposeSubtree;
