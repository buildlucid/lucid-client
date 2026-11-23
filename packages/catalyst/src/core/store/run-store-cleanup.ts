import { error } from "../../runtime/log.js";
import { runUnowned } from "../../runtime/reactive.js";
import type { RuntimeStore } from "../../runtime/types.js";
import type { StoreCleanup } from "../../types/index.js";

/** Cleanups may write state, so they run outside any owned scope. */
const runStoreCleanup = (store: RuntimeStore, cleanup: StoreCleanup) => {
	runUnowned(() => {
		try {
			cleanup();
		} catch (cause) {
			error(`The cleanup for store "${store.key}" threw.`, cause);
		}
	});
};

export default runStoreCleanup;
