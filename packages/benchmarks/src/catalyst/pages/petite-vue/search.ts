import { createApp } from "petite-vue";
import { buildRows, filterRows, ROW_COUNT } from "../../data.ts";

createApp({
	query: "",
	items: buildRows(ROW_COUNT),
	get matches() {
		return filterRows(this.items, this.query);
	},
}).mount("#app");
