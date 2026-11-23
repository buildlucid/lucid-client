import { createEffect, runWithOwner } from "solid-js";
import { error, warn } from "../../runtime/log.js";
import { runEffectCallback, runUnowned } from "../../runtime/reactive.js";
import type { RuntimeStore } from "../../runtime/types.js";
import type {
	AnyStoreDefinition,
	StoreCleanup,
	StoreContext,
	StoreEffect,
	StoreEffectHelper,
	StoreState,
	StoreActions,
} from "../../types/index.js";
import runStoreCleanup from "./run-store-cleanup.js";

type Context = StoreContext<StoreState, {}, StoreActions>;

const effect: StoreEffectHelper = (compute, callback) => ({
	compute,
	effect: callback,
});

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
	typeof value === "object" &&
	value !== null &&
	"then" in value &&
	typeof value.then === "function";

const isStoreEffect = (value: unknown): value is StoreEffect =>
	typeof value === "object" &&
	value !== null &&
	"compute" in value &&
	"effect" in value &&
	typeof value.compute === "function" &&
	typeof value.effect === "function";

const setCleanup = (store: RuntimeStore, cleanup: unknown) => {
	if (typeof cleanup !== "function") return;
	// An async init can settle after its store was destroyed.
	if (store.destroyed) runStoreCleanup(store, cleanup as StoreCleanup);
	else store.cleanup = cleanup as StoreCleanup;
};

const runInit = (
	store: RuntimeStore,
	definition: AnyStoreDefinition,
	context: Context,
) => {
	if (!definition.init) return;
	const fail = (cause: unknown) =>
		error(`The init for store "${store.key}" threw.`, cause);

	try {
		const result = definition.init(context);
		if (isPromiseLike(result)) {
			Promise.resolve(result).then(
				(cleanup) => setCleanup(store, cleanup),
				fail,
			);
			return;
		}
		setCleanup(store, result);
	} catch (cause) {
		fail(cause);
	}
};

const runStoreEffect = (
	store: RuntimeStore,
	name: string,
	storeEffect: StoreEffect,
) => {
	let isInitial = true;
	const fail = (cause: unknown) =>
		error(`The effect "${name}" on store "${store.key}" threw.`, cause);
	createEffect(() => storeEffect.compute(), {
		effect: (value: unknown, previous?: unknown) =>
			runEffectCallback(() => {
				const context = { isInitial, previous };
				isInitial = false;
				return storeEffect.effect(value, context);
			}, fail),
		error: fail,
	});
};

/** Effects are owned by the store, so they are disposed with it. */
const startEffects = (
	store: RuntimeStore,
	definition: AnyStoreDefinition,
	context: Context,
) => {
	if (!definition.effects) return;
	const effects = definition.effects;

	runWithOwner(store.owner, () => {
		let values: Record<string, unknown>;
		try {
			values = effects({ ...context, effect }) ?? {};
		} catch (cause) {
			error(`The effects for store "${store.key}" threw.`, cause);
			return;
		}

		for (const [name, value] of Object.entries(values)) {
			if (!isStoreEffect(value)) {
				if (__DEV__)
					warn(
						`The effect "${name}" on store "${store.key}" must be created with effect(compute, callback).`,
					);
				continue;
			}
			runStoreEffect(store, name, value);
		}
	});
};

/** Runs a store's `init` once its refs exist, then starts its effects. */
const startStore = (store: RuntimeStore) => {
	if (store.initialised || store.destroyed) return;
	store.initialised = true;

	const definition = store.definition;
	if (!definition) return;

	const context: Context = {
		state: store.state,
		setState: store.setState,
		actions: store.actions,
		refs: store.refs,
	};

	// `init` may write state, which Solid only permits outside an owned scope,
	// and nothing it reads should subscribe whichever effect triggered the sync.
	runUnowned(() => runInit(store, definition, context));
	if (store.destroyed) return;
	startEffects(store, definition, context);
};

export default startStore;
