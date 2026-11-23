import type { StoreActions, StoreDefinition } from "../types/index.js";

/**
 * Declares a store. State, computed values and actions are inferred from the
 * definition, so no generic types are needed. Register it with
 * `Catalyst.start({ stores: { scope: definition } })`.
 */
const defineStore = <
	S extends object = {},
	C = {},
	A extends StoreActions = {},
>(
	definition: StoreDefinition<S, C, A>,
) => definition;

export default defineStore;
