import { createApp } from "petite-vue";
import { buildRows, ROW_COUNT, type Row } from "../../data.ts";

createApp({
	rows: [] as Row[],
	selected: null as number | null,
	run() {
		this.rows = buildRows(ROW_COUNT);
		this.selected = null;
	},
	add() {
		this.rows.push(...buildRows(ROW_COUNT));
	},
	update() {
		for (let index = 0; index < this.rows.length; index += 10) {
			const row = this.rows[index];
			if (row) row.label += " !!!";
		}
	},
	clear() {
		this.rows = [];
		this.selected = null;
	},
	swap() {
		const second = this.rows[1];
		const last = this.rows[998];
		if (!second || !last) return;
		this.rows[1] = last;
		this.rows[998] = second;
	},
	select(id: number) {
		this.selected = id;
	},
	remove(id: number) {
		this.rows.splice(
			this.rows.findIndex((row) => row.id === id),
			1,
		);
	},
}).mount("#app");
