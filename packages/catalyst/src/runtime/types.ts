import type {
	CatalystStartOptions,
	Reaction,
	Directive,
	Store,
	StoreActions,
	StoreModule,
	StoreState,
} from "../types/index.js";

export type ResolvedCatalystOptions = {
	debug: boolean;
	attributes: {
		prefix: string;
		store: string;
		state: string;
		scopeSeparator: string;
		specifierSeparator: string;
	};
};

export type DirectiveRegistration = {
	directive: Directive;
	/** The store the directive's scope resolved to when it was initialised. */
	scopeStore: Store | undefined;
	dispose: () => void;
};

export type CatalystRuntime = {
	options: ResolvedCatalystOptions;
	startOptions?: CatalystStartOptions;
	started: boolean;
	reactions: Map<string, Reaction>;
	stores: Map<string, Store>;
	storesByElement: Map<Element, Store>;
	storeModules: Map<string, StoreModule<StoreState, StoreActions>>;
	registrations: Map<Element, Map<string, DirectiveRegistration>>;
	/** Registrations indexed by the store scope their reference targets. */
	scopeDependents: Map<string, Set<DirectiveRegistration>>;
	removalObserver?: MutationObserver;
};
