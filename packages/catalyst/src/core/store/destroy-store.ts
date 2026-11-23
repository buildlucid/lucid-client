import Catalyst from "../../runtime/catalyst.js";
import { debug } from "../../runtime/log.js";
import { releaseScopeDependents } from "../../runtime/pending-registration.js";
import type { RuntimeStore } from "../../runtime/types.js";
import runStoreCleanup from "./run-store-cleanup.js";

const attempt = (fn: () => void) => {
	try {
		fn();
	} catch (cause) {
		console.error(cause);
	}
};

const destroyStore = (store: RuntimeStore) => {
	if (store.destroyed) return;
	store.destroyed = true;

	store.stateObserver?.disconnect();
	const cleanup = store.cleanup;
	store.cleanup = undefined;
	if (cleanup) runStoreCleanup(store, cleanup);

	for (const dispose of store.stateAttributeDisposes.values()) attempt(dispose);
	store.stateAttributeDisposes.clear();
	for (const entry of store.persisted.values()) {
		if (entry.dispose) attempt(entry.dispose);
	}
	store.persisted.clear();
	// Disposes the store's computed values and effects.
	attempt(store.disposeRoot);

	if (Catalyst.stores.get(store.key) === store) {
		Catalyst.stores.delete(store.key);
	}
	if (Catalyst.storesByElement.get(store.element) === store) {
		Catalyst.storesByElement.delete(store.element);
	}
	attempt(() => releaseScopeDependents(store));
	if (__DEV__) debug(`Store destroyed for scope "${store.key}".`);
};

export default destroyStore;
