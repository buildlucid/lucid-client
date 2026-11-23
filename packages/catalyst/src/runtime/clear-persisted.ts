import { removeStored } from "../core/persist/persist-value.js";
import Catalyst from "./catalyst.js";
import { warn } from "./log.js";

/**
 * Removes the saved values of a running store, or of every running store,
 * such as when a user logs out. State keeps its current values, and each one
 * is saved again the next time it changes.
 */
const clearPersisted = (scope?: string) => {
	if (!Catalyst.started) {
		warn("Catalyst must be started before persisted state can be cleared.");
		return;
	}

	const store = scope === undefined ? undefined : Catalyst.stores.get(scope);
	if (scope !== undefined && !store) {
		warn(`Cannot clear persisted state for unknown store "${scope}".`);
		return;
	}

	for (const target of store ? [store] : Catalyst.stores.values()) {
		for (const entry of target.persisted.values()) {
			removeStored(target.key, entry);
			entry.saved = undefined;
		}
	}
};

export default clearPersisted;
