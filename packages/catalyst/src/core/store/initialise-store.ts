import { type Accessor, createMemo, createStore, getOwner } from "solid-js";
import Catalyst from "../../runtime/catalyst.js";
import { debug, error, warn } from "../../runtime/log.js";
import { createOwnedRoot } from "../../runtime/reactive.js";
import type { RuntimeStore } from "../../runtime/types.js";
import type {
	AnyStoreDefinition,
	PersistOptions,
	StoreState,
} from "../../types/index.js";
import { unwrapPersisted } from "../persist/persisted.js";
import resolvePersistence from "../persist/resolve-persistence.js";
import {
	registerPersistence,
	restorePersistedState,
} from "../persist/store-persistence.js";
import { createRefs } from "../refs/index.js";
import {
	createStateObserver,
	createStateView,
	readStateAttributes,
	registerStateAttribute,
} from "../state/index.js";

const isStateObject = (value: unknown): value is StoreState =>
	typeof value === "object" && value !== null && !Array.isArray(value);

type Defaults = {
	state: StoreState;
	/** The options of each state value marked with `persisted()`. */
	persist: Map<string, PersistOptions>;
};

const noDefaults = (): Defaults => ({ state: {}, persist: new Map() });

/**
 * A plain state object is copied for every store so a refreshed store starts
 * from its defaults again. A function is called instead, for state that can't
 * be copied, such as functions or class instances. `persisted()` values are
 * unwrapped first, since copying would turn them into plain objects.
 */
const resolveDefaults = (
	key: string,
	definition: AnyStoreDefinition | undefined,
): Defaults => {
	const state = definition?.state;
	if (state === undefined) return noDefaults();

	const isFactory = typeof state === "function";
	let value: unknown;
	let persist = new Map<string, PersistOptions>();
	try {
		value = isFactory ? (state as () => unknown)() : state;
		if (isStateObject(value)) {
			const unwrapped = unwrapPersisted(value);
			persist = unwrapped.options;
			value = isFactory ? unwrapped.values : structuredClone(unwrapped.values);
		} else if (!isFactory) {
			value = structuredClone(value);
		}
	} catch (cause) {
		error(
			isFactory
				? `The state function for store "${key}" threw.`
				: `The state for store "${key}" could not be copied. Use a function that returns the state instead.`,
			cause,
		);
		return noDefaults();
	}

	if (isStateObject(value)) return { state: value, persist };
	warn(`The state for store "${key}" must be an object.`);
	return noDefaults();
};

const applyComputed = (store: RuntimeStore, definition: AnyStoreDefinition) => {
	if (!definition.computed) return;

	let values: Record<string, unknown>;
	try {
		values = definition.computed({ state: store.state }) ?? {};
	} catch (cause) {
		error(`The computed values for store "${store.key}" threw.`, cause);
		return;
	}

	for (const [name, compute] of Object.entries(values)) {
		if (typeof compute !== "function") {
			warn(
				`The computed value "${name}" on store "${store.key}" must be a function.`,
			);
			continue;
		}
		if (name in store.raw) {
			warn(
				`The computed value "${name}" on store "${store.key}" has the same name as a state value, which it hides.`,
			);
		}
		try {
			const memo: Accessor<unknown> = createMemo(() => compute());
			store.computed.set(name, memo);
		} catch (cause) {
			error(
				`The computed value "${name}" on store "${store.key}" threw.`,
				cause,
			);
		}
	}
};

const applyActions = (store: RuntimeStore, definition: AnyStoreDefinition) => {
	if (!definition.actions) return;
	try {
		const actions = definition.actions({
			state: store.state,
			setState: store.setState,
			refs: store.refs,
		});
		if (actions) Object.assign(store.actions, actions);
	} catch (cause) {
		error(`The actions for store "${store.key}" threw.`, cause);
	}
};

/**
 * A failing definition never prevents the store from being created: its HTML
 * state still works, and every other store and directive still initialises.
 */
const initialiseStore = (element: Element, key: string): RuntimeStore => {
	const definition = Catalyst.storeDefinitions.get(key);

	const store = createOwnedRoot((disposeRoot) => {
		// State is complete before the Solid store exists, because writing to it
		// while this root is being set up is not allowed.
		const defaults = resolveDefaults(key, definition);
		const initial = readStateAttributes(element, key, defaults.state);
		const persistence = resolvePersistence(
			element,
			key,
			defaults.persist,
			initial.state,
		);
		restorePersistedState(key, persistence, initial.state);
		const [raw, setState] = createStore<StoreState>(initial.state);
		const computed = new Map<string, Accessor<unknown>>();
		const refElements = new Map<string, Element | Element[]>();

		const nextStore: RuntimeStore = {
			key,
			element,
			definition,
			initialised: false,
			destroyed: false,
			state: createStateView(key, raw, computed),
			raw,
			setState,
			computed,
			actions: {},
			refs: createRefs(refElements),
			refElements,
			owner: getOwner(),
			stateAttributeDisposes: new Map(),
			internalStateWrites: new Map(),
			persisted: new Map(),
			disposeRoot,
		};

		if (definition) applyComputed(nextStore, definition);
		for (const stateKey of initial.keys) {
			registerStateAttribute(nextStore, stateKey);
		}
		registerPersistence(nextStore, persistence);
		if (definition) applyActions(nextStore, definition);

		nextStore.stateObserver = createStateObserver(nextStore);
		return nextStore;
	});

	Catalyst.stores.set(key, store);
	Catalyst.storesByElement.set(element, store);
	debug(`Store created for scope "${key}".`);
	return store;
};

export default initialiseStore;
