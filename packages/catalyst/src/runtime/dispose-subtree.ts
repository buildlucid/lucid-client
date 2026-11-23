import { destroyStore } from "../core/store/index.js";
import type { SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectElements from "./collect-elements.js";
import { disposeElementRegistrations } from "./dispose-registration.js";

/**
 * Disposes the directives and stores in a subtree. Directives are disposed
 * before stores, and elements are looked up one by one, so the cost scales
 * with the subtree rather than with every registration on the page.
 */
const disposeSubtree = (target: Element, options?: SyncOptions) => {
	const elements = collectElements(target, options);
	for (const element of elements) disposeElementRegistrations(element);

	// Usually there are far fewer stores than elements, such as when a loop
	// clears its items, so the stores are checked instead.
	if (Catalyst.storesByElement.size < elements.length) {
		for (const store of Array.from(Catalyst.storesByElement.values())) {
			const element = store.element;
			if (options?.childrenOnly && element === target) continue;
			if (target.contains(element)) destroyStore(store);
		}
		return;
	}
	for (const element of elements) {
		const store = Catalyst.storesByElement.get(element);
		if (store) destroyStore(store);
	}
};

export default disposeSubtree;
