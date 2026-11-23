import type { StoreSetter } from "solid-js";

export type StoreState = Record<string, unknown>;

// Actions deliberately accept arbitrary arguments so event listeners can retain
// their concrete event parameter types in userland stores.
export type Action = (...args: any[]) => unknown;
export type StoreActions = Record<string, Action>;

/**
 * Elements registered with `data-ref="#name"` or `data-ref="#name[]"`. The
 * element type is a cast, so pass the type you expect: `refs.get<HTMLInputElement>("search")`.
 */
export type StoreRefs = {
	/** The element registered under `name`, or the first one for a `[]` ref. */
	get: <E extends Element = HTMLElement>(name: string) => E | undefined;
	/** Every element registered under `name`, in registration order. */
	all: <E extends Element = HTMLElement>(name: string) => E[];
};

export type StoreEffectContext<T> = {
	/** `true` for the effect's first run. */
	isInitial: boolean;
	/** The value `compute` returned on the previous run. */
	previous: T | undefined;
};

export type StoreEffectCallback<T> = (
	value: T,
	context: StoreEffectContext<T>,
) => void | (() => void);

/**
 * A two-phase store effect, mirroring Solid 2's `createEffect`. Create one with
 * the `effect` helper passed to a store's `effects`.
 */
export type StoreEffect<T = any> = {
	compute: () => T;
	effect: StoreEffectCallback<T>;
};

/**
 * Creates a store effect. `compute` is tracked: every state value it reads
 * re-runs the effect. `effect` receives the computed value and runs untracked,
 * so it is where side effects belong. It may return a cleanup function, which
 * runs before the next run and when the store is destroyed.
 */
export type StoreEffectHelper = <T>(
	compute: () => T,
	effect: StoreEffectCallback<T>,
) => StoreEffect<T>;

export type StoreCleanup = () => void;

export type ComputedContext<S> = {
	/** The store's state. Read it to make the computed value track it. */
	readonly state: Readonly<S>;
};

export type ActionsContext<S, C> = {
	/** The store's state and computed values. */
	readonly state: Readonly<S & C>;
	/** Writes state through a draft: `setState((state) => { state.open = true; })`. */
	readonly setState: StoreSetter<S>;
	readonly refs: StoreRefs;
};

export type StoreContext<S, C, A> = ActionsContext<S, C> & {
	readonly actions: A;
};

export type EffectsContext<S, C, A> = StoreContext<S, C, A> & {
	readonly effect: StoreEffectHelper;
};

export type StoreComputed<C> = { [K in keyof C]: () => C[K] };

/**
 * A store definition. Each key maps to the markup: `state` and `computed` are
 * read with `$name`, and `actions` are called with `@name`.
 */
export type StoreDefinition<
	S extends object = StoreState,
	C = {},
	A extends StoreActions = {},
> = {
	/**
	 * The store's state, as a plain object that is copied for every store
	 * instance, or a function that returns it. A matching `data-state--*`
	 * attribute sets the starting value, and this value provides the default and
	 * the type.
	 */
	state?: S | (() => S);
	/** Read-only values derived from state, recomputed only when it changes. */
	computed?: (context: ComputedContext<S>) => StoreComputed<C>;
	/** Functions markup calls with `@name`, and that other store code can call. */
	actions?: (context: ActionsContext<S, C>) => A;
	/** Effects that run for as long as the store exists. */
	effects?: (context: EffectsContext<S, C, A>) => Record<string, StoreEffect>;
	/**
	 * Runs once the store's refs are registered. Return a function to clean up
	 * when the store is destroyed.
	 */
	init?: (
		context: StoreContext<S, C, A>,
	) => void | StoreCleanup | Promise<void | StoreCleanup>;
};

export type AnyStoreDefinition = StoreDefinition<any, any, any>;

/** A running store, as custom reactions receive it. */
export type Store = {
	readonly key: string;
	readonly element: Element;
	readonly state: Readonly<StoreState>;
	readonly setState: StoreSetter<StoreState>;
	readonly actions: StoreActions;
	readonly refs: StoreRefs;
};
