import type { Reaction } from "./reactions.js";
import type { AnyStoreDefinition } from "./store.js";

export type CatalystAttributeOptions = {
	prefix?: string;
	store?: string;
	state?: string;
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
};
