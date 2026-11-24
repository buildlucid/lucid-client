import type {
	CatalystPersistenceOptions,
	Persistence,
	StorageAdapter,
} from "../../types/index.js";
import { localAdapter, sessionAdapter } from "./adapters.js";
import resolvePersistence from "./resolve-persistence.js";
import {
	registerPersistence,
	restorePersistedState,
} from "./store-persistence.js";

/** `persistence()`'s options with their defaults applied. */
export type PersistenceConfig = {
	prefix: string;
	storage: string;
	sync: boolean;
	adapters: Record<string, StorageAdapter>;
};

/**
 * Saves `persisted()` state and `data-persist` keys to storage, and restores
 * them when the page loads again. Pass it to Catalyst when starting:
 * `Catalyst.init({ persistence: persistence() })`.
 */
const persistence = (options: CatalystPersistenceOptions = {}): Persistence => {
	const config: PersistenceConfig = {
		prefix: options.prefix ?? "catalyst:",
		storage: options.storage ?? "local",
		sync: options.sync ?? false,
		adapters: {
			local: localAdapter,
			session: sessionAdapter,
			...options.adapters,
		},
	};

	return {
		restore: (element, storeKey, requested, state) => {
			const entries = resolvePersistence(
				config,
				element,
				storeKey,
				requested,
				state,
			);
			restorePersistedState(storeKey, entries, state);
			return entries;
		},
		register: registerPersistence,
	};
};

export default persistence;
