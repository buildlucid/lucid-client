import { defineStore } from "@lucidclient/catalyst";
import type { LoopItem } from "@lucidclient/catalyst/types";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("visibility");

const enterLeave = defineStore({
	state: { inView: false, enters: 0, leaves: 0 },
	computed: ({ state }) => ({
		status: () =>
			`${state.inView ? "in view" : "out of view"} · enters ${state.enters} · leaves ${state.leaves}`,
	}),
	actions: ({ setState }) => ({
		enter: (entry: IntersectionObserverEntry) => {
			setState((state) => {
				state.inView = true;
				state.enters += 1;
			});
			log.info(
				`Entered at ${Math.round(entry.intersectionRatio * 100)}% visible`,
			);
		},
		leave: () => {
			setState((state) => {
				state.inView = false;
				state.leaves += 1;
			});
			log.info("Left the viewport");
		},
	}),
});

type Card = { id: number; hue: number; loaded: boolean };

const lazy = defineStore({
	state: {
		cards: Array.from({ length: 12 }, (_, index): Card => ({
			id: index + 1,
			hue: (index * 37) % 360,
			loaded: false,
		})),
	},
	computed: ({ state }) => ({
		status: () =>
			`loaded ${state.cards.filter((card) => card.loaded).length} of ${state.cards.length}`,
	}),
	actions: ({ setState }) => ({
		cardLabel: ({ item }: LoopItem<Card>) =>
			`Card ${item.id} · ${item.loaded ? "loaded" : "waiting"}`,
		load: (_entry: IntersectionObserverEntry, { item }: LoopItem<Card>) => {
			setState(() => {
				item.loaded = true;
			});
			log.info(`Loaded card ${item.id}`);
		},
	}),
});

const PAGE = 10;
const LIMIT = 60;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const feed = defineStore({
	state: {
		rows: Array.from({ length: PAGE }, (_, index) => index + 1),
		loading: false,
	},
	computed: ({ state }) => ({
		canLoad: () => !state.loading && state.rows.length < LIMIT,
		status: () =>
			state.rows.length >= LIMIT
				? "All loaded"
				: state.loading
					? "Loading…"
					: "",
	}),
	actions: ({ state, setState }) => ({
		loadMore: async () => {
			if (state.loading || state.rows.length >= LIMIT) return;
			setState((draft) => {
				draft.loading = true;
			});
			await delay(400);
			setState((draft) => {
				const start = draft.rows.length;
				for (let index = 1; index <= PAGE; index += 1) {
					draft.rows.push(start + index);
				}
				draft.loading = false;
			});
			log.info(`Loaded rows up to ${state.rows.length + PAGE}`);
		},
	}),
});

const thresholds = defineStore({
	state: { any: 0, half: 0, full: 0 },
	computed: ({ state }) => ({
		status: () => `any ${state.any} · half ${state.half} · full ${state.full}`,
	}),
	actions: ({ setState }) => {
		const count = (key: "any" | "half" | "full") => () =>
			setState((state) => {
				state[key] += 1;
			});
		return { any: count("any"), half: count("half"), full: count("full") };
	},
});

startCatalyst({ stores: { enterLeave, lazy, feed, thresholds } });
