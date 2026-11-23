import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { bind, dom, events, loop } from "@lucidclient/catalyst/reactions";
import type { LoopItem } from "@lucidclient/catalyst/types";
import { buildRows, ROW_COUNT, type Row } from "../../data.ts";

const rows = defineStore({
	state: {
		rows: [] as Row[],
		selected: null as number | null,
	},
	actions: ({ state, setState }) => ({
		run: () =>
			setState((draft) => {
				draft.rows = buildRows(ROW_COUNT);
				draft.selected = null;
			}),
		add: () =>
			setState((draft) => {
				draft.rows.push(...buildRows(ROW_COUNT));
			}),
		update: () =>
			setState((draft) => {
				for (let index = 0; index < draft.rows.length; index += 10) {
					const row = draft.rows[index];
					if (row) row.label += " !!!";
				}
			}),
		clear: () =>
			setState((draft) => {
				draft.rows = [];
				draft.selected = null;
			}),
		swap: () =>
			setState((draft) => {
				const second = draft.rows[1];
				const last = draft.rows[998];
				if (!second || !last) return;
				draft.rows[1] = last;
				draft.rows[998] = second;
			}),
		select: (_event: Event, { item }: LoopItem<Row>) =>
			setState((draft) => {
				draft.selected = item.id;
			}),
		remove: (_event: Event, { index }: LoopItem<Row>) =>
			setState((draft) => {
				draft.rows.splice(index, 1);
			}),
		rowClass: ({ item }: LoopItem<Row>) =>
			state.selected === item.id ? "danger" : null,
	}),
});

Catalyst.start({
	stores: { rows },
	reactions: [bind, dom, events, loop],
});
