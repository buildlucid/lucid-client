import Catalyst from "../../runtime/catalyst.js";
import { debug, error } from "../../runtime/log.js";
import { runUnowned } from "../../runtime/reactive.js";
import type { Store } from "../../types/index.js";

const attempt = (fn: () => void) => {
	try {
		fn();
	} catch (cause) {
		console.error(cause);
	}
};

const destroyStore = (store: Store) => {
	if (store.destroyed) return;
	store.destroyed = true;

	store.stateObserver?.disconnect();
	if (store.cleanup) {
		const cleanup = store.cleanup;
		runUnowned(() => {
			try {
				cleanup();
			} catch (cause) {
				error(`The cleanup for store "${store.key}" threw.`, cause);
			}
		});
	}

	for (const dispose of store.stateAttributeDisposes.values()) attempt(dispose);
	store.stateAttributeDisposes.clear();
	attempt(store.disposeRoot);

	if (Catalyst.stores.get(store.key) === store) {
		Catalyst.stores.delete(store.key);
	}
	if (Catalyst.storesByElement.get(store.element) === store) {
		Catalyst.storesByElement.delete(store.element);
	}
	debug(`Store destroyed for scope "${store.key}".`);
};

export default destroyStore;
