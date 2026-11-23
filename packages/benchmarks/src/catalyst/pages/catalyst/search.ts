import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { dom, loop, model } from "@lucidclient/catalyst/reactions";
import { buildRows, filterRows, ROW_COUNT } from "../../data.ts";

const search = defineStore({
	state: {
		query: "",
		items: buildRows(ROW_COUNT),
	},
	computed: ({ state }) => ({
		matches: () => filterRows(state.items, state.query),
	}),
});

Catalyst.start({
	stores: { search },
	reactions: [dom, loop, model],
});
