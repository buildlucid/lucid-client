import Alpine from "alpinejs";
import { buildRows, matchesQuery, ROW_COUNT } from "../../data.ts";

Alpine.data("search", () => ({
	query: "",
	items: buildRows(ROW_COUNT),
	get matches() {
		return this.items.filter((item) => matchesQuery(item, this.query));
	},
}));

Alpine.start();
