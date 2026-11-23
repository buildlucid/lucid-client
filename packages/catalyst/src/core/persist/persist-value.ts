import { debug, error, warn } from "../../runtime/log.js";
import type { PersistEntry } from "../../runtime/types.js";

/** `null` and `undefined` are "empty", which matches any kind. */
export const kindOf = (value: unknown) => {
	if (value === null || value === undefined) return "empty";
	if (Array.isArray(value)) return "array";
	return typeof value;
};

/** A value as JSON, or `undefined` for `undefined` or a value that can't be. */
export const toJson = (value: unknown): string | undefined => {
	try {
		return JSON.stringify(value);
	} catch {
		return undefined;
	}
};

/** Storage failures are expected where storage is blocked or full, so they are reported once per value. */
const reportFailure = (
	entry: PersistEntry,
	message: string,
	cause: unknown,
) => {
	if (entry.reported) return;
	entry.reported = true;
	warn(message, cause);
};

const describe = (storeKey: string, entry: PersistEntry) =>
	`"${entry.key}" on store "${storeKey}"`;

/**
 * Whether a stored value can be used. It must have the same kind as the state's
 * starting value, so a value saved by an older version of the page with a
 * different type is ignored, and it must pass `validate`.
 */
export const acceptsStored = (
	storeKey: string,
	entry: PersistEntry,
	value: unknown,
) => {
	const kind = kindOf(value);
	if (entry.kind !== "empty" && kind !== "empty" && kind !== entry.kind) {
		debug(
			`Ignored the stored ${describe(storeKey, entry)}, which is a ${kind} rather than a ${entry.kind}.`,
		);
		return false;
	}
	if (!entry.validate) return true;
	try {
		if (entry.validate(value)) return true;
		debug(
			`Ignored the stored ${describe(storeKey, entry)}, which validate rejected.`,
		);
	} catch (cause) {
		error(
			`The validate option for "${entry.key}" on store "${storeKey}" threw.`,
			cause,
		);
	}
	return false;
};

/** The stored value, or `undefined` when there is none or it can't be read. */
export const readStored = (storeKey: string, entry: PersistEntry) => {
	try {
		return entry.adapter.get(entry.storageKey);
	} catch (cause) {
		reportFailure(
			entry,
			`Could not restore ${describe(storeKey, entry)} from ${entry.storage} storage, so it starts from its default.`,
			cause,
		);
		return undefined;
	}
};

/** Saves a value. `undefined` can't be saved as JSON, so it removes the entry. */
export const writeStored = (
	storeKey: string,
	entry: PersistEntry,
	value: unknown,
) => {
	try {
		if (value === undefined) entry.adapter.remove(entry.storageKey);
		else entry.adapter.set(entry.storageKey, value);
	} catch (cause) {
		reportFailure(
			entry,
			`Could not save ${describe(storeKey, entry)} to ${entry.storage} storage, so it won't be restored.`,
			cause,
		);
	}
};

export const removeStored = (storeKey: string, entry: PersistEntry) => {
	try {
		entry.adapter.remove(entry.storageKey);
	} catch (cause) {
		reportFailure(
			entry,
			`Could not remove ${describe(storeKey, entry)} from ${entry.storage} storage.`,
			cause,
		);
	}
};

/** Subscribes to changes made elsewhere, returning the function that stops it. */
export const subscribeStored = (
	storeKey: string,
	entry: PersistEntry,
	onChange: (value: unknown) => void,
) => {
	if (!entry.sync || !entry.adapter.subscribe) return undefined;
	try {
		return entry.adapter.subscribe(entry.storageKey, onChange);
	} catch (cause) {
		reportFailure(
			entry,
			`Could not watch ${describe(storeKey, entry)} in ${entry.storage} storage for changes from other tabs.`,
			cause,
		);
		return undefined;
	}
};
