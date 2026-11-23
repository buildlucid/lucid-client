import { defineStore } from "@lucidclient/catalyst";

const loopsStore = defineStore({
	state: {
		items: [
			{ title: "title one", url: "/one" },
			{ title: "title two", url: "/two" },
			{ title: "title threee", url: "/three" },
		],
	},
	actions: ({ state, setState }) => ({
		childOnClick: () => {
			setState((draft) => {
				draft.items.push({ title: "A new title?", url: "/new" });
			});
		},
		getItems: () => state.items,
	}),
	init: ({ state }) => {
		console.log("store", state);
	},
});

export default loopsStore;
