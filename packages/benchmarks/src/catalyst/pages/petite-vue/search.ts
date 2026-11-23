import { createApp } from "petite-vue";
import { buildRows, matchesQuery, ROW_COUNT } from "../../data.ts";

createApp({
	query: "",
	items: buildRows(ROW_COUNT),
	get matches() {
		return this.items.filter((item) => matchesQuery(item, this.query));
	},
}).mount("#app");
