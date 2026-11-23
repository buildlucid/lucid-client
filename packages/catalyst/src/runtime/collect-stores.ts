import { syncStateAttributes } from "../core/state/index.js";
import { destroyStore, initialiseStore } from "../core/store/index.js";
import type { SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectElements from "./collect-elements.js";
import disposeSubtree from "./dispose-subtree.js";
import { warn } from "./log.js";
import type { RuntimeStore } from "./types.js";

const collectStores = (target: Element, options?: SyncOptions) => {
	const stores: RuntimeStore[] = [];
	const storeAttribute = `${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.store}`;

	for (const element of collectElements(target, options)) {
		const elementStore = Catalyst.storesByElement.get(element);
		const key = element.getAttribute(storeAttribute);

		if (elementStore && elementStore.key !== key) destroyStore(elementStore);
		if (key === null) continue;
		if (!key) {
			if (__DEV__)
				warn(`The "${storeAttribute}" attribute requires a scope value.`);
			continue;
		}

		const existingStore = Catalyst.stores.get(key);
		// A store whose element was removed in this same task is disposed now,
		// rather than when the removal observer runs, so its replacement can
		// take the scope.
		if (existingStore && !existingStore.element.isConnected) {
			disposeSubtree(existingStore.element);
		} else if (existingStore) {
			if (existingStore.element !== element) {
				if (__DEV__)
					warn(
						`The store scope "${key}" is already used by another element, so this element and its directives are skipped.`,
					);
				continue;
			}
			syncStateAttributes(existingStore);
			continue;
		}

		stores.push(initialiseStore(element, key));
	}

	return stores;
};

export default collectStores;
