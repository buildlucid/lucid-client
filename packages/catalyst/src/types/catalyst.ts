import type { CatalystPersistenceOptions } from "./persistence.js";
import type { Reaction } from "./reactions.js";
import type { AnyStoreDefinition } from "./store.js";

export type CatalystAttributeOptions = {
	prefix?: string;
	store?: string;
	state?: string;
	persist?: string;
	scopeSeparator?: string;
	specifierSeparator?: string;
};

/** Store definitions keyed by the `data-store` scope they apply to. */
export type CatalystStores = Record<string, AnyStoreDefinition>;

export type CatalystStartOptions = {
	debug?: boolean;
	stores?: CatalystStores;
	reactions?: Reaction[];
	attributes?: CatalystAttributeOptions;
	/** Where `persisted()` state and `data-persist` attributes save values. */
	persistence?: CatalystPersistenceOptions;
};

export type CatalystAddOptions = {
	stores?: CatalystStores;
};

export type CatalystApi = {
	start: (options?: CatalystStartOptions) => void;
	add: (options: CatalystAddOptions) => void;
	destroy: () => void;
	refresh: (targetStore?: string) => void;
	sync: (target: Element, options?: { childrenOnly?: boolean }) => void;
	/**
	 * Removes the saved values of a running store, or of every running store,
	 * from storage. State keeps its current values, and is saved again the next
	 * time it changes.
	 */
	clearPersisted: (scope?: string) => void;
};
