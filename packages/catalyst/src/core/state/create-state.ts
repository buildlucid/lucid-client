import { type Signal, createSignal, getObserver, untrack } from "solid-js";
import { warn } from "../../runtime/log.js";
import type { StateSetter, StoreState } from "../../types/index.js";

/**
 * A store's state: plain objects and arrays behind proxies, with one Solid
 * signal for each property that is read reactively or written. Reads track the
 * property they read, so changing nested data updates exactly what reads it.
 *
 * Signals hold the value as of the last flush, as Solid's own stores do: until
 * Solid flushes, reads return the previous value. Inside `setState`, reads
 * return the latest values, so the draft can be changed step by step.
 */

/** Signal values are boxed, so functions and promises are stored as they are. */
type Box = { value: unknown };

/** Reading this returns a proxy's plain object. */
export const RAW = Symbol("catalyst.raw");

const proxies = new WeakMap<object, object>();
const propertySignals = new WeakMap<object, Map<PropertyKey, Signal<Box>>>();
/** Changed when a property is added or removed, for `in` and key listings. */
const keySignals = new WeakMap<object, Signal<undefined>>();

/** Inside `setState`, proxies can be written and read their latest values. */
let writing = 0;

/** Plain objects and arrays become reactive. Anything else is stored as a value. */
const isWrappable = (value: object) => {
	if (Object.isFrozen(value)) return false;
	if (Array.isArray(value)) return true;
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};

const wrap = (value: unknown) => {
	if (typeof value !== "object" || value === null) return value;
	const existing = proxies.get(value);
	if (existing) return existing;
	if (!isWrappable(value)) return value;
	const proxy = new Proxy(value, handler);
	proxies.set(value, proxy);
	return proxy;
};

/**
 * State holds plain objects only, so proxies written into it, such as
 * `state.items = state.items.filter(...)`, are replaced with their plain
 * objects. A proxy's plain object never holds proxies, so it isn't walked.
 */
const unwrap = (value: unknown, seen = new Set<object>()): unknown => {
	if (typeof value !== "object" || value === null) return value;
	const raw = (value as { [RAW]?: object })[RAW];
	if (raw) return raw;
	if (seen.has(value) || !isWrappable(value)) return value;
	seen.add(value);
	const record = value as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		const item = record[key];
		const unwrapped = unwrap(item, seen);
		if (unwrapped !== item) record[key] = unwrapped;
	}
	return value;
};

const getSignal = (target: object, property: PropertyKey) =>
	propertySignals.get(target)?.get(property);

const createPropertySignal = (
	target: object,
	property: PropertyKey,
	value: unknown,
) => {
	let signals = propertySignals.get(target);
	if (!signals) {
		signals = new Map();
		propertySignals.set(target, signals);
	}
	const signal = createSignal<Box>({ value });
	signals.set(property, signal);
	return signal;
};

/** Inherited properties, such as array methods, aren't tracked. */
const isTracked = (target: object, property: PropertyKey) =>
	Object.hasOwn(target, property) || !(property in target);

const read = (target: Record<PropertyKey, unknown>, property: PropertyKey) => {
	if (writing === 0) {
		let signal = getSignal(target, property);
		if (!signal && getObserver() && isTracked(target, property)) {
			signal = createPropertySignal(target, property, target[property]);
		}
		if (signal) return signal[0]().value;
	}
	return target[property];
};

/**
 * Updates a property's signal. A property that has none yet gets one holding
 * its previous value first, so reads before the next flush still return it.
 */
const notify = (
	target: object,
	property: PropertyKey,
	previous: unknown,
	value: unknown,
) => {
	const signal =
		getSignal(target, property) ??
		createPropertySignal(target, property, previous);
	signal[1]({ value });
};

const trackKeys = (target: object) => {
	if (writing > 0 || !getObserver()) return;
	let signal = keySignals.get(target);
	if (!signal) {
		signal = createSignal<undefined>(undefined, { equals: false });
		keySignals.set(target, signal);
	}
	signal[0]();
};

const notifyKeys = (target: object) => {
	keySignals.get(target)?.[1](undefined);
};

/** Removing array items through `length` updates each removed index's signal. */
const truncate = (target: unknown[], length: number, previous: number) => {
	for (let index = length; index < previous; index += 1) {
		getSignal(target, String(index))?.[1]({ value: undefined });
	}
	notifyKeys(target);
};

const setProperty = (
	target: Record<PropertyKey, unknown>,
	property: PropertyKey,
	value: unknown,
) => {
	const isNew = !Object.hasOwn(target, property);
	const previous = target[property];
	if (!isNew && previous === value) return;

	const array = Array.isArray(target) ? target : null;
	const previousLength = array?.length ?? 0;
	target[property] = value;
	notify(target, property, previous, value);
	if (isNew) notifyKeys(target);
	if (!array || array.length === previousLength) return;
	if (property !== "length") {
		notify(target, "length", previousLength, array.length);
	} else if (array.length < previousLength) {
		truncate(array, array.length, previousLength);
	}
};

const deleteProperty = (
	target: Record<PropertyKey, unknown>,
	property: PropertyKey,
) => {
	if (!Object.hasOwn(target, property)) return;
	const previous = target[property];
	delete target[property];
	notify(target, property, previous, undefined);
	notifyKeys(target);
};

const rejectWrite = (property: PropertyKey) => {
	if (__DEV__) {
		const name = String(property);
		warn(
			`Cannot write "${name}" directly. Use setState((state) => { state.${name} = value; }).`,
		);
	}
	return true;
};

const handler: ProxyHandler<Record<PropertyKey, unknown>> = {
	get: (target, property) => {
		if (property === RAW) return target;
		if (typeof property === "symbol") return target[property];
		return wrap(read(target, property));
	},
	has: (target, property) => {
		trackKeys(target);
		return property in target;
	},
	ownKeys: (target) => {
		trackKeys(target);
		return Reflect.ownKeys(target);
	},
	set: (target, property, value) => {
		if (writing === 0) return rejectWrite(property);
		setProperty(target, property, unwrap(value));
		return true;
	},
	deleteProperty: (target, property) => {
		if (writing === 0) return rejectWrite(property);
		deleteProperty(target, property);
		return true;
	},
	defineProperty: (target, property, descriptor) => {
		if (writing === 0) return rejectWrite(property);
		if ("value" in descriptor) {
			setProperty(target, property, unwrap(descriptor.value));
			return true;
		}
		return Reflect.defineProperty(target, property, descriptor);
	},
};

/**
 * Creates a store's state from its starting values. The state is read-only:
 * write it with the returned setter, whose draft can be changed in place.
 */
const createState = (
	initial: StoreState,
): [state: StoreState, setState: StateSetter<StoreState>] => {
	const state = wrap(unwrap(initial)) as StoreState;
	const setState: StateSetter<StoreState> = (update) => {
		writing += 1;
		try {
			untrack(() => update(state));
		} finally {
			writing -= 1;
		}
	};
	return [state, setState];
};

/**
 * The plain value behind a piece of state, without tracking it, such as to log
 * it or send it elsewhere. Treat it as read-only, since it is the store's own
 * object.
 */
export const snapshot = <T>(value: T): T => {
	if (typeof value !== "object" || value === null) return value;
	return ((value as { [RAW]?: T })[RAW] ?? value) as T;
};

export default createState;
