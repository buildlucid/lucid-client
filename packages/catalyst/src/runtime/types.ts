import type { Accessor, Owner, StoreSetter } from "solid-js";
import type {
	AnyStoreDefinition,
	CatalystStartOptions,
	Directive,
	Reaction,
	StoreActions,
	StoreCleanup,
	Persistence,
	StorageAdapter,
	StoreRefs,
	StoreState,
} from "../types/index.js";

export type ResolvedCatalystOptions = {
	debug: boolean;
	attributes: {
		prefix: string;
		store: string;
		state: string;
		persist: string;
		scopeSeparator: string;
		specifierSeparator: string;
	};
};

/** A state value a store saves to storage. */
export type PersistEntry = {
	/** The state key. */
	key: string;
	/** The adapter's name, for messages. */
	storage: string;
	adapter: StorageAdapter;
	/** The storage entry's full name, including the prefix. */
	storageKey: string;
	validate?: (value: unknown) => boolean;
	sync: boolean;
	/** The kind of value the state starts with, which stored values must match. */
	kind: string;
	/** The starting value without storage, as JSON, used when storage is cleared elsewhere. */
	fallback: string | undefined;
	/** The value as JSON when it was last restored or saved, so it isn't saved again unchanged. */
	saved: string | undefined;
	/** Whether a storage failure has already been reported. */
	reported: boolean;
	dispose?: () => void;
};

/** A store's full runtime record. Reactions receive it as the public `Store`. */
export type RuntimeStore = {
	key: string;
	element: Element;
	definition: AnyStoreDefinition | undefined;
	initialised: boolean;
	destroyed: boolean;
	/** Read-only view over `raw` and the computed values. */
	state: StoreState;
	/** The Solid store holding the state values. */
	raw: StoreState;
	setState: StoreSetter<StoreState>;
	computed: Map<string, Accessor<unknown>>;
	actions: StoreActions;
	refs: StoreRefs;
	refElements: Map<string, Element | Element[]>;
	/** The store's reactive owner, which store effects are created under. */
	owner: Owner | null;
	stateAttributeDisposes: Map<string, () => void>;
	internalStateWrites: Map<string, string>;
	stateObserver?: MutationObserver;
	/** The state values saved to storage, by state key. */
	persisted: Map<string, PersistEntry>;
	disposeRoot: () => void;
	cleanup?: StoreCleanup;
};

export type DirectiveRegistration = {
	directive: Directive;
	/** The store the directive's scope resolved to when it was initialised. */
	scopeStore: RuntimeStore | undefined;
	dispose: () => void;
};

export type CatalystRuntime = {
	options: ResolvedCatalystOptions;
	startOptions?: CatalystStartOptions;
	started: boolean;
	reactions: Map<string, Reaction>;
	stores: Map<string, RuntimeStore>;
	storesByElement: Map<Element, RuntimeStore>;
	storeDefinitions: Map<string, AnyStoreDefinition>;
	registrations: Map<Element, Map<string, DirectiveRegistration>>;
	/** Registrations indexed by the store scope their reference targets. */
	scopeDependents: Map<string, Set<DirectiveRegistration>>;
	/** First-party reactions already reported as missing while debugging. */
	reportedReactions: Set<string>;
	/** Saves and restores state, when `Catalyst.start` was given `persistence()`. */
	persistence?: Persistence;
	removalObserver?: MutationObserver;
};
