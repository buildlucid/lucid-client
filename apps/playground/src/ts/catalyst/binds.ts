import { defineStore } from "@lucidclient/catalyst";

const bindsStore = defineStore({
	state: {
		storeState: 69,
	},
	actions: ({ setState }) => ({
		incrementStoreState: () => {
			setState((state) => {
				state.storeState += 1;
			});
		},
	}),
});

export default bindsStore;
