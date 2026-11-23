import type { StorageAdapter } from "../../types/index.js";

/** Text that isn't valid JSON, such as a value written by other code, is treated as missing. */
const parse = (text: string | null): unknown => {
	if (text === null) return undefined;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
};

/**
 * Saves values as JSON in `localStorage` or `sessionStorage`. The storage is
 * looked up on every call, because reading it throws where storage is
 * blocked, which Catalyst catches.
 */
const createWebStorageAdapter = (
	getStorage: () => Storage,
): StorageAdapter => ({
	get: (key) => parse(getStorage().getItem(key)),
	set: (key, value) => getStorage().setItem(key, JSON.stringify(value)),
	remove: (key) => getStorage().removeItem(key),
	subscribe: (key, onChange) => {
		const storage = getStorage();
		const listener = (event: StorageEvent) => {
			if (event.storageArea !== storage) return;
			// A `null` key means the whole storage was cleared.
			if (event.key === null) onChange(undefined);
			else if (event.key === key) onChange(parse(event.newValue));
		};
		window.addEventListener("storage", listener);
		return () => window.removeEventListener("storage", listener);
	},
});

export const localAdapter = createWebStorageAdapter(() => window.localStorage);
export const sessionAdapter = createWebStorageAdapter(
	() => window.sessionStorage,
);
