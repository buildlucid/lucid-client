import type { StoreActions } from "../types/index.js";
import type {
	InferredStoreModule,
	ModuleStateSignals,
} from "./store-module.js";

const defineStoreModule = <
	S extends ModuleStateSignals,
	A extends StoreActions,
>(
	module: InferredStoreModule<S, A>,
) => module;

export default defineStoreModule;
