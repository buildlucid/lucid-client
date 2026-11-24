import Catalyst from "../../runtime/catalyst.js";
import { warn } from "../../runtime/log.js";
import { removeStored } from "./persist-value.js";

/**
 * Removes the saved values of a running store, or of every running store,
 * such as when a user logs out. State keeps its current values, and each one
 * is saved again the next time it changes.
 */
const clearPersisted = (scope?: string) => {
	if (!Catalyst.initialised) {
		if (__DEV__)
			warn(
				"Catalyst must be initialised before persisted state can be cleared.",
			);
		return;
	}

	const store = scope === undefined ? undefined : Catalyst.stores.get(scope);
	if (scope !== undefined && !store) {
		if (__DEV__)
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
