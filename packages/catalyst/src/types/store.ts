import type { Signal } from "solid-js";

export type StoreState = Record<string, unknown>;

// Actions deliberately accept arbitrary arguments so event listeners can retain
// their concrete event parameter types in userland store modules.
export type Action = (...args: any[]) => unknown;
export type StoreActions = Record<string, Action>;

export type StoreEffectContext<T> = {
	/** `true` for the effect's first run. */
	isInitial: boolean;
	/** The value `compute` returned on the previous run. */
	previous: T | undefined;
};

/**
 * A two-phase store effect, mirroring Solid 2's `createEffect`.
 *
 * `compute` is tracked: every signal it reads re-runs the effect. `effect`
 * receives the computed value and runs untracked, so it is where side effects
 * belong. `effect` may return a cleanup function, which runs before the next
 * run and when the effect is disposed.
 */
export type StoreEffect<T = any> = {
	compute: () => T;
	effect: (value: T, context: StoreEffectContext<T>) => void | (() => void);
};
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
	destroyed: boolean;
};
