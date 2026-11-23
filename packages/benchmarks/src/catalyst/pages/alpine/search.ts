import Alpine from "alpinejs";
import { buildRows, filterRows, ROW_COUNT } from "../../data.ts";

Alpine.data("search", () => ({
	query: "",
	items: buildRows(ROW_COUNT),
	get matches() {
		return filterRows(this.items, this.query);
	},
}));

Alpine.start();
