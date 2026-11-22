import { runUnowned } from "../../runtime/reactive.js";
import type { Store } from "../../types/index.js";

const initialiseStoreAction = (store: Store) => {
	if (store.initialised || store.destroyed) return;
	store.initialised = true;

	// `init` may write state, which Solid only permits outside an owned scope,
	// and nothing it reads should subscribe whichever effect triggered the sync.
	runUnowned(() => {
		try {
			const result = store.actions.init?.();
			void Promise.resolve(result).catch(console.error);
		} catch (error) {
			console.error(error);
		}
	});
};

export default initialiseStoreAction;
