import { createRoot } from "solid-js";
import Catalyst from "../../runtime/catalyst.js";
import { debug } from "../../runtime/log.js";
import type { Store } from "../../types/index.js";
import { createStateObserver, syncStateAttributes } from "../state/index.js";
import getStoreInterface from "./get-store-interface.js";

const initialiseStore = (element: Element, key: string): Store => {
	const store = createRoot((disposeRoot) => {
		const nextStore: Store = {
			key,
			element,
			initialised: false,
			state: {},
			actions: {},
			effects: { global: {}, manual: {} },
			refs: new Map(),
			stateAttributeDisposes: new Map(),
			internalStateWrites: new Map(),
			disposeRoot,
		};

		const storeModule = Catalyst.storeModules.get(key);
		if (storeModule) {
			const state = storeModule.state?.();
			if (state) Object.assign(nextStore.state, state);
		}

		syncStateAttributes(nextStore);

		if (storeModule) {
			const result = storeModule.setup(getStoreInterface(nextStore));
			if (result.actions) Object.assign(nextStore.actions, result.actions);
			if (result.effects?.global) {
				Object.assign(nextStore.effects.global, result.effects.global);
			}
			if (result.effects?.manual) {
				Object.assign(nextStore.effects.manual, result.effects.manual);
			}
			if (result.cleanup) nextStore.cleanup = result.cleanup;
		}

		nextStore.stateObserver = createStateObserver(nextStore);
		return nextStore;
	});

	Catalyst.stores.set(key, store);
	debug(`Store created for scope "${key}".`);
	return store;
};

export default initialiseStore;
