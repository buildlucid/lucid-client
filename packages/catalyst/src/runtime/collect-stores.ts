import { syncStateAttributes } from "../core/state/index.js";
import { destroyStore, initialiseStore } from "../core/store/index.js";
import type { Store, SyncOptions } from "../types/index.js";
import Catalyst from "./catalyst.js";
import collectElements from "./collect-elements.js";
import disposeRegistration from "./dispose-registration.js";
import { warn } from "./log.js";

/** Destroys a store whose element no longer declares it, with its global effects. */
const retireStore = (store: Store) => {
	const registrations = Catalyst.registrations.get(store.element);
	for (const registration of Array.from(registrations?.values() ?? [])) {
		if (registration.directive.synthetic) disposeRegistration(registration);
	}
	destroyStore(store);
};

const collectStores = (target: Element, options?: SyncOptions) => {
	const stores: Store[] = [];
	const storeAttribute = `${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.store}`;

	for (const element of collectElements(target, options)) {
		const elementStore = Catalyst.storesByElement.get(element);
		const key = element.getAttribute(storeAttribute);

		if (elementStore && elementStore.key !== key) retireStore(elementStore);
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
