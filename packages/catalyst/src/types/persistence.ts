import type { PersistEntry, RuntimeStore } from "../runtime/types.js";
import type { StoreState } from "./store.js";

declare const persistedBrand: unique symbol;

/** Options for a state value marked with `persisted()`. */
export type PersistOptions = {
	/**
	 * Where the value is saved: `"local"`, `"session"` or the name of an adapter
	 * registered with `persistence({ adapters })`. Defaults to the `storage`
	 * option of `persistence()`, which is `"local"` unless it is configured.
	 */
	storage?: string;
	/**
	 * The name of the storage entry, after the configured prefix. Defaults to
	 * `{scope}:{key}`, so each scope a definition is registered under saves its
	 * own value.
	 */
	key?: string;
	/**
	 * Accepts or rejects a stored value, such as one saved by an older version of
	 * the page. A rejected value is ignored and the starting value is used.
	 */
	validate?: (value: unknown) => boolean;
	/**
	 * Applies changes saved by other tabs. Defaults to the `sync` option of
	 * `persistence()`, which is `false` unless it is configured.
	 */
	sync?: boolean;
};

/**
 * A state value marked with `persisted()`. The store's state holds the value
 * itself, so `state.theme` is typed as the value rather than as this wrapper.
 */
export type Persisted<T> = {
	readonly [persistedBrand]: true;
	readonly value: T;
	readonly options: PersistOptions;
};

/** A store's state, with its `persisted()` values unwrapped. */
export type StateOf<S> = {
	[K in keyof S]: S[K] extends Persisted<infer V> ? V : S[K];
};

/**
 * Saves persisted state somewhere other than `localStorage` or
 * `sessionStorage`. Values are passed as they are, so the adapter decides how
 * they are encoded. Every method may throw: Catalyst catches the error, warns
 * once, and the state keeps working without being saved.
 */
export type StorageAdapter = {
	/** The stored value, or `undefined` when nothing is stored. */
	get: (key: string) => unknown;
	/** Saves a value. `undefined` is never passed: `remove` is called instead. */
	set: (key: string, value: unknown) => void;
	remove: (key: string) => void;
	/**
	 * Calls `onChange` when the value is changed somewhere else, such as in
	 * another tab, with `undefined` when it is removed. Returns a function that
	 * stops listening. Only used when sync is on.
	 */
	subscribe?: (key: string, onChange: (value: unknown) => void) => () => void;
};

/** Options for `persistence()`. */
export type CatalystPersistenceOptions = {
	/** Prepended to every storage entry's name. Defaults to `"catalyst:"`. */
	prefix?: string;
	/**
	 * The storage used by `persisted()` values without a `storage` option, and by
	 * a `data-persist` attribute without a specifier. Defaults to `"local"`.
	 */
	storage?: string;
	/** Applies changes saved by other tabs. Defaults to `false`. */
	sync?: boolean;
	/**
	 * Storage adapters by name, used as `persisted(value, { storage: name })` or
	 * `data-persist--name`. HTML lowercases attribute names, so give adapters
	 * used in markup lowercase names. `local` and `session` are built in, and
	 * can be replaced.
	 */
	adapters?: Record<string, StorageAdapter>;
};

/**
 * Saves and restores state values. Create it with `persistence()` from
 * `@lucidclient/catalyst/persistence` and pass it to `Catalyst.init`, so pages
 * that don't persist state don't include it.
 */
export type Persistence = {
	/**
	 * Applies stored values to a new store's starting state, before the store
	 * exists, and returns the values the store saves.
	 */
	restore: (
		element: Element,
		storeKey: string,
		requested: ReadonlyMap<string, PersistOptions>,
		state: StoreState,
	) => PersistEntry[];
	/** Saves a new store's values whenever they change. */
	register: (store: RuntimeStore, entries: PersistEntry[]) => void;
};
