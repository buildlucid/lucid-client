import type { Persisted, PersistOptions } from "../../types/index.js";

const PERSISTED = Symbol("catalyst.persisted");

type PersistedMarker = {
	[PERSISTED]: true;
	value: unknown;
	options: PersistOptions;
};

/**
 * Marks a top-level state value to be saved to storage and restored when the
 * page loads again: `state: { theme: persisted("light") }`. The store's state
 * holds the value itself, typed as the value.
 */
const persisted = <T>(value: T, options: PersistOptions = {}): Persisted<T> =>
	Object.freeze({
		[PERSISTED]: true,
		value,
		options,
	}) as unknown as Persisted<T>;

export const isPersisted = (value: unknown): value is PersistedMarker =>
	typeof value === "object" && value !== null && PERSISTED in value;

/** Shared by every state object without persisted values. Never changed. */
const NO_OPTIONS: ReadonlyMap<string, PersistOptions> = new Map();

/**
 * Replaces each top-level `persisted()` value with the value it wraps, and
 * returns the options of every persisted key.
 */
export const unwrapPersisted = (state: Record<string, unknown>) => {
	if (!Object.values(state).some(isPersisted)) {
		return { values: state, options: NO_OPTIONS };
	}
	const values: Record<string, unknown> = {};
	const options = new Map<string, PersistOptions>();
	for (const [key, value] of Object.entries(state)) {
		if (isPersisted(value)) {
			values[key] = value.value;
			options.set(key, value.options);
		} else {
			values[key] = value;
		}
	}
	return { values, options };
};

export default persisted;
