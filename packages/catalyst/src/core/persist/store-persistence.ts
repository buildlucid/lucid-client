import { createEffect, snapshot } from "solid-js";
import { debug } from "../../runtime/log.js";
import {
	createOwnedRoot,
	runEffectCallback,
	runUnowned,
} from "../../runtime/reactive.js";
import type { PersistEntry, RuntimeStore } from "../../runtime/types.js";
import type { StoreState } from "../../types/index.js";
import {
	acceptsStored,
	readStored,
	subscribeStored,
	toJson,
	writeStored,
} from "./persist-value.js";

const UNSAVEABLE = Symbol("unsaveable");

/**
 * Applies stored values to a new store's starting state, before the Solid store
 * exists, so bindings, `init` and effects all see them from the start. A
 * stored value replaces the definition's default and any `data-state--*`
 * attribute, because restoring what the user chose is the point.
 */
export const restorePersistedState = (
	storeKey: string,
	entries: PersistEntry[],
	state: StoreState,
) => {
	for (const entry of entries) {
		const stored = readStored(storeKey, entry);
		if (stored === undefined) continue;
		if (!acceptsStored(storeKey, entry, stored)) continue;
		state[entry.key] = stored;
		entry.saved = toJson(stored);
		if (__DEV__)
			debug(
				`Restored "${entry.key}" on store "${storeKey}" from ${entry.storage} storage.`,
			);
	}
};

/** A change saved by another tab, or its removal, which resets the starting value. */
const applyExternal = (
	store: RuntimeStore,
	entry: PersistEntry,
	value: unknown,
) => {
	if (store.destroyed) return;
	let next: unknown;
	if (value === undefined) {
		next =
			entry.fallback === undefined ? undefined : JSON.parse(entry.fallback);
	} else if (acceptsStored(store.key, entry, value)) {
		next = value;
	} else {
		return;
	}
	// Recorded first, so the change isn't saved straight back.
	entry.saved = toJson(next);
	runUnowned(() =>
		store.setState((state) => {
			state[entry.key] = next;
		}),
	);
};

/**
 * Saves a persisted value whenever it changes. The value is serialised while
 * tracking, so changing nested data, such as pushing to an array, saves it
 * too. A value that hasn't changed since it was restored or saved isn't
 * written, so a value the user never changed keeps following its default.
 */
const registerEntry = (store: RuntimeStore, entry: PersistEntry) => {
	const disposeEffect = createOwnedRoot((disposeRoot) => {
		createEffect(
			(): string | undefined | typeof UNSAVEABLE => {
				try {
					return JSON.stringify(store.raw[entry.key]);
				} catch {
					return UNSAVEABLE;
				}
			},
			(json) =>
				runEffectCallback(() => {
					if (json === entry.saved) return;
					// A value JSON can't represent is still passed on, so the adapter
					// reports it rather than it being dropped silently.
					if (json !== UNSAVEABLE) entry.saved = json;
					writeStored(store.key, entry, snapshot(store.raw[entry.key]));
				}),
		);
		return disposeRoot;
	});

	const unsubscribe = subscribeStored(store.key, entry, (value) =>
		applyExternal(store, entry, value),
	);

	entry.dispose = () => {
		disposeEffect();
		unsubscribe?.();
	};
	store.persisted.set(entry.key, entry);
};

export const registerPersistence = (
	store: RuntimeStore,
	entries: PersistEntry[],
) => {
	for (const entry of entries) registerEntry(store, entry);
};
