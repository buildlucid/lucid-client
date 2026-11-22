import Catalyst from "./catalyst.js";
import disposeSubtree from "./dispose-subtree.js";
import { warn } from "./log.js";
import { flushUpdates } from "./reactive.js";
import { syncTarget } from "./sync.js";

/**
 * Rebuilds a store (or every store) from scratch. Directives elsewhere on the
 * page that reference a rebuilt store re-initialise against the new one.
 */
const refresh = (targetStore?: string) => {
	if (!Catalyst.started) {
		warn("Catalyst must be started before it can be refreshed.");
		return;
	}

	if (targetStore) {
		const store = Catalyst.stores.get(targetStore);
		if (!store) {
			warn(`Cannot refresh unknown store "${targetStore}".`);
			return;
		}

		const target = store.element;
		disposeSubtree(target);
		syncTarget(target);
		flushUpdates();
		return;
	}

	disposeSubtree(document.body);
	syncTarget(document.body);
	flushUpdates();
};

export default refresh;
