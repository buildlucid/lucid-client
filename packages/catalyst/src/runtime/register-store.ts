import type { AnyStoreDefinition, CatalystStores } from "../types/index.js";
import Catalyst from "./catalyst.js";
import { warn } from "./log.js";

/** Registers a store definition. Returns `true` when it was newly added. */
const registerStore = (key: string, definition: AnyStoreDefinition) => {
	if (!key) {
		warn("Stores require a scope name.");
		return false;
	}

	const existing = Catalyst.storeDefinitions.get(key);
	// Starting again after `destroy` passes the same definitions again.
	if (existing === definition) return false;
	if (existing) {
		warn(`A store is already registered for scope "${key}".`);
		return false;
	}

	Catalyst.storeDefinitions.set(key, definition);
	return true;
};

export const registerStores = (stores: CatalystStores | undefined) => {
	const added: string[] = [];
	for (const [key, definition] of Object.entries(stores ?? {})) {
		if (registerStore(key, definition)) added.push(key);
	}
	return added;
};

export default registerStore;
