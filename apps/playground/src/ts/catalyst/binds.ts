import { createSignal, defineStoreModule } from "@lucidclient/catalyst";

const bindsStore = defineStoreModule({
	state: () => ({
		storeState: createSignal(69),
	}),
	setup: (store) => ({
		actions: {
			incrementStoreState: () => {
				const [, setStoreState] = store.state.storeState;
				setStoreState((previous) => previous + 1);
			},
		},
	}),
});

export default bindsStore;
