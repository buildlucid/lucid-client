import Catalyst from "../../runtime/catalyst.js";
import { warn } from "../../runtime/log.js";
import type { PersistEntry } from "../../runtime/types.js";
import type { PersistOptions, StoreState } from "../../types/index.js";
import { kindOf } from "./persist-value.js";
import type { PersistenceConfig } from "./persistence.js";

const getPersistAttribute = () =>
	`${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.persist}`;

/**
 * Reads `data-persist="theme sidebarOpen"` and `data-persist--session="draft"`.
 * Returns each listed key with the storage its specifier names, or `null` for
 * the attribute without a specifier.
 */
const readPersistAttributes = (element: Element) => {
	const base = getPersistAttribute();
	const specifierPrefix = `${base}${Catalyst.options.attributes.specifierSeparator}`;
	const keys = new Map<string, { storage: string | null; attribute: string }>();

	for (const attribute of Array.from(element.attributes)) {
		let storage: string | null;
		if (attribute.name === base) storage = null;
		else if (attribute.name.startsWith(specifierPrefix)) {
			storage = attribute.name.slice(specifierPrefix.length);
			if (!storage) continue;
		} else continue;

		for (const key of attribute.value.split(/[\s,]+/)) {
			if (key) keys.set(key, { storage, attribute: attribute.name });
		}
	}
	return keys;
};

/** Plain data only: anything else would not come back from JSON as it was. */
const isJsonSafe = (value: unknown, seen = new Set<object>()): boolean => {
	if (value === null || value === undefined) return true;
	const type = typeof value;
	if (type === "string" || type === "number" || type === "boolean") return true;
	if (type !== "object") return false;

	const object = value as object;
	if (seen.has(object)) return false;
	seen.add(object);
	if (Array.isArray(object)) {
		return object.every((item) => isJsonSafe(item, seen));
	}
	const prototype = Object.getPrototypeOf(object) as unknown;
	if (prototype !== Object.prototype && prototype !== null) return false;
	return Object.values(object).every((item) => isJsonSafe(item, seen));
};

const toCamelCase = (key: string) =>
	key.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());

const warnUnknownKey = (
	storeKey: string,
	key: string,
	attribute: string | undefined,
	state: StoreState,
) => {
	const camel = toCamelCase(key);
	if (attribute && camel !== key && camel in state) {
		if (__DEV__)
			warn(
				`The "${attribute}" value "${key}" on store "${storeKey}" does not match the "${camel}" state. Use "${camel}" instead.`,
			);
		return;
	}
	if (__DEV__)
		warn(
			`Cannot persist "${key}" on store "${storeKey}" because it isn't a state value.`,
		);
};

const findAdapter = (
	adapters: PersistenceConfig["adapters"],
	storeKey: string,
	key: string,
	storage: string,
) => {
	if (Object.hasOwn(adapters, storage)) return adapters[storage];

	const caseMatch = Object.keys(adapters).find(
		(name) => name.toLowerCase() === storage.toLowerCase(),
	);
	if (__DEV__)
		warn(
			caseMatch
				? `The "${storage}" storage for "${key}" on store "${storeKey}" isn't registered. HTML lowercases attribute names, so register the "${caseMatch}" adapter under a lowercase name.`
				: `The "${storage}" storage for "${key}" on store "${storeKey}" isn't registered. Add it to persistence({ adapters }).`,
		);
	return undefined;
};

/**
 * Decides which state values a new store saves, from its definition's
 * `persisted()` values and its element's `data-persist` attributes. Markup can
 * persist more keys and choose their storage for this store only.
 */
const resolvePersistence = (
	config: PersistenceConfig,
	element: Element,
	storeKey: string,
	requested: ReadonlyMap<string, PersistOptions>,
	state: StoreState,
): PersistEntry[] => {
	const markup = readPersistAttributes(element);
	const entries: PersistEntry[] = [];

	for (const key of new Set([...requested.keys(), ...markup.keys()])) {
		const fromMarkup = markup.get(key);
		if (!(key in state)) {
			if (__DEV__) warnUnknownKey(storeKey, key, fromMarkup?.attribute, state);
			continue;
		}
		const value = state[key];
		if (!isJsonSafe(value)) {
			if (__DEV__)
				warn(
					`Cannot persist "${key}" on store "${storeKey}" because its value can't be saved as JSON.`,
				);
			continue;
		}

		const options = requested.get(key) ?? {};
		const storage = fromMarkup?.storage ?? options.storage ?? config.storage;
		const adapter = findAdapter(config.adapters, storeKey, key, storage);
		if (!adapter) continue;

		const json = JSON.stringify(value);
		entries.push({
			key,
			storage,
			adapter,
			storageKey: `${config.prefix}${options.key ?? `${storeKey}:${key}`}`,
			validate: options.validate,
			sync: options.sync ?? config.sync,
			kind: kindOf(value),
			fallback: json,
			saved: json,
			reported: false,
		});
	}
	return entries;
};

export default resolvePersistence;
