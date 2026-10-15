import type { Signal } from "solid-js";

export type StoreState = Record<string, unknown>;

// Actions deliberately accept arbitrary arguments so event listeners can retain
// their concrete event parameter types in userland store modules.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
export type Action = (...args: any[]) => unknown;
export type StoreActions = Record<string, Action>;

export type StoreEffect = (context: { isInitial: boolean }) => void;
export type StoreEffects = Record<string, StoreEffect>;
export type Refs = Map<string, Element | Element[]>;

export type StoreStateSignals<S extends StoreState> = {
	[K in keyof S]: Signal<S[K]>;
};

export type StoreInterface<S extends StoreState, A extends StoreActions> = {
	readonly state: StoreStateSignals<S>;
	readonly actions: A;
	readonly refs: Refs;
};

export type StoreModuleSetupInterface<S extends StoreState> = Pick<
	StoreInterface<S, StoreActions>,
	"refs" | "state"
>;

export type StoreModuleResult<A extends StoreActions> = {
	actions: A;
	effects?: {
		global?: StoreEffects;
		manual?: StoreEffects;
	};
	cleanup?: () => void;
};

export type StoreModule<
	S extends StoreState = StoreState,
	A extends StoreActions = StoreActions,
> = {
	state?: () => Partial<StoreStateSignals<S>>;
	setup: (store: StoreModuleSetupInterface<S>) => StoreModuleResult<A>;
};

export type Store<
	S extends StoreState = StoreState,
	A extends StoreActions = StoreActions,
> = {
	key: string;
	element: Element;
	initialised: boolean;
	state: StoreStateSignals<S>;
	actions: A;
	effects: {
		global: StoreEffects;
		manual: StoreEffects;
	};
	refs: Refs;
	stateAttributeDisposes: Map<string, () => void>;
	internalStateWrites: Map<string, string>;
	stateObserver?: MutationObserver;
	disposeRoot: () => void;
	cleanup?: () => void;
};
