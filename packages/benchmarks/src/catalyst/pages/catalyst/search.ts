import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { dom, loop, model } from "@lucidclient/catalyst/reactions";
import { buildRows, matchesQuery, ROW_COUNT } from "../../data.ts";

const search = defineStore({
	state: {
		query: "",
		items: buildRows(ROW_COUNT),
	},
	computed: ({ state }) => ({
		matches: () =>
			state.items.filter((item) => matchesQuery(item, state.query)),
	}),
});

Catalyst.start({
	stores: { search },
	reactions: [dom, loop, model],
});
