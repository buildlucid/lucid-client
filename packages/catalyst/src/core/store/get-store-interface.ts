import type {
	Store,
	StoreModuleSetupInterface,
	StoreState,
} from "../../types/index.js";

const getStoreInterface = <S extends StoreState>(
	store: Store<S>,
): StoreModuleSetupInterface<S> => ({
	get state() {
		return store.state;
	},
	get refs() {
		return store.refs;
	},
});

export default getStoreInterface;
