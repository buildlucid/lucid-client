import Catalyst from "../../runtime/catalyst.js";
import { debug, error } from "../../runtime/log.js";
import { createOwnedRoot } from "../../runtime/reactive.js";
import type { Store, StoreModule } from "../../types/index.js";
import { createStateObserver, syncStateAttributes } from "../state/index.js";
import getStoreInterface from "./get-store-interface.js";

const applyModuleState = (store: Store, storeModule: StoreModule) => {
	if (!storeModule.state) return;
	try {
		const state = storeModule.state();
		if (state) Object.assign(store.state, state);
	} catch (cause) {
		error(`The state factory for store "${store.key}" threw.`, cause);
	}
};

const applyModuleSetup = (store: Store, storeModule: StoreModule) => {
	try {
		const result = storeModule.setup(getStoreInterface(store));
		if (result.actions) Object.assign(store.actions, result.actions);
		if (result.effects?.global) {
			Object.assign(store.effects.global, result.effects.global);
		}
		if (result.effects?.manual) {
			Object.assign(store.effects.manual, result.effects.manual);
		}
		if (result.cleanup) store.cleanup = result.cleanup;
	} catch (cause) {
		error(`The setup for store "${store.key}" threw.`, cause);
	}
};

/**
 * A failing module never prevents the store from being created: its HTML
 * state still works, and every other store and directive still initialises.
 */
const initialiseStore = (element: Element, key: string): Store => {
	const store = createOwnedRoot((disposeRoot) => {
		const nextStore: Store = {
			key,
			element,
			initialised: false,
			destroyed: false,
			state: {},
			actions: {},
			effects: { global: {}, manual: {} },
			refs: new Map(),
			stateAttributeDisposes: new Map(),
			internalStateWrites: new Map(),
			disposeRoot,
		};

		const storeModule = Catalyst.storeModules.get(key);
		if (storeModule) applyModuleState(nextStore, storeModule);
		syncStateAttributes(nextStore);
		if (storeModule) applyModuleSetup(nextStore, storeModule);

		nextStore.stateObserver = createStateObserver(nextStore);
		return nextStore;
	});

	Catalyst.stores.set(key, store);
	Catalyst.storesByElement.set(element, store);
	debug(`Store created for scope "${key}".`);
	return store;
};

export default initialiseStore;
