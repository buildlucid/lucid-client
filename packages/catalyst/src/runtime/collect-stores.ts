import { syncStateAttributes } from "../core/state/index.js";
import { destroyStore, initialiseStore } from "../core/store/index.js";
import type { SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectElements from "./collect-elements.js";
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
			warn(`The "${storeAttribute}" attribute requires a scope value.`);
			continue;
		}

		const existingStore = Catalyst.stores.get(key);
		if (existingStore) {
			if (existingStore.element !== element) {
				warn(`The store scope "${key}" is already used by another element.`);
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
