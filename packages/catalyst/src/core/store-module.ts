import type { Signal } from "solid-js";
import Catalyst from "../runtime/catalyst.js";
import { warn } from "../runtime/log.js";
import type {
	StoreActions,
	StoreModule,
	StoreModuleResult,
	StoreModuleSetupInterface,
	StoreState,
} from "../types/index.js";

// biome-ignore lint/suspicious/noExplicitAny: signal values must remain inferable
export type ModuleStateSignals = Record<string, Signal<any>>;

type InferModuleState<S extends ModuleStateSignals> = {
	[K in keyof S]: S[K] extends Signal<infer V> ? V : never;
};

export type InferredStoreModule<
	S extends ModuleStateSignals,
	A extends StoreActions,
> = {
	state?: () => S;
	setup: (
		store: StoreModuleSetupInterface<InferModuleState<S>>,
	) => StoreModuleResult<A>;
};

const storeModule = <S extends ModuleStateSignals, A extends StoreActions>(
	key: string,
	module: InferredStoreModule<S, A>,
) => {
	if (Catalyst.storeModules.has(key)) {
		warn(`A store module is already registered for scope "${key}".`);
		return;
	}

	Catalyst.storeModules.set(
		key,
		module as unknown as StoreModule<StoreState, StoreActions>,
	);
};

export default storeModule;
