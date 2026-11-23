import type { Accessor } from "solid-js";
import { warn } from "../../runtime/log.js";
import type { StoreState } from "../../types/index.js";

/**
 * A read-only view over a store's state and computed values, so both are read
 * the same way: `state.open` and `state.buttonLabel`. Reads track like any
 * Solid store read. Writes go through `setState`.
 */
const createStateView = (
	key: string,
	raw: StoreState,
	computed: Map<string, Accessor<unknown>>,
): StoreState => {
	const read = (property: string) => {
		const memo = computed.get(property);
		return memo ? memo() : raw[property];
	};
	const has = (property: string | symbol) =>
		typeof property === "string" && (computed.has(property) || property in raw);
	const rejectWrite = (property: string | symbol) => {
		const name = String(property);
		if (__DEV__)
			warn(
				`Cannot write "${name}" on store "${key}" directly. Use setState((state) => { state.${name} = value; }).`,
			);
		return true;
	};

	return new Proxy<StoreState>(
		{},
		{
			get: (_, property) =>
				typeof property === "string" ? read(property) : undefined,
			has: (_, property) => has(property),
			ownKeys: () =>
				Array.from(
					new Set([...Object.keys(raw), ...Array.from(computed.keys())]),
				),
			getOwnPropertyDescriptor: (_, property) => {
				if (typeof property !== "string" || !has(property)) return undefined;
				return {
					get: () => read(property),
					enumerable: true,
					configurable: true,
				};
			},
			set: (_, property) => rejectWrite(property),
			deleteProperty: (_, property) => rejectWrite(property),
			defineProperty: (_, property) => rejectWrite(property),
		},
	);
};

export default createStateView;
