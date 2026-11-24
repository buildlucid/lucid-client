import { defineStore, viewTransition } from "@lucidclient/catalyst";
import type { LoopItem } from "@lucidclient/catalyst/types";
import { initCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("animations");

// --------------------------------------------------------
// Support

const support = defineStore({
	state: { summary: "" },
	init: ({ setState }) => {
		const supported = typeof document.startViewTransition === "function";
		const types =
			typeof ViewTransition === "function" &&
			"types" in ViewTransition.prototype;
		const matchElement = CSS.supports("view-transition-name", "match-element");
		const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
		setState((state) => {
			state.summary = [
				`view transitions  ${supported ? "yes" : "no"}`,
				`transition types  ${types ? "yes" : "no"}`,
				`match-element     ${matchElement ? "yes" : "no"}`,
				`reduced motion    ${reduced ? "on, so changes apply without a transition" : "off"}`,
			].join("\n");
		});
	},
});

// --------------------------------------------------------
// A list that moves

type Tile = { label: string; hue: number };

let next = 1;
const createTile = (): Tile => {
	const tile = { label: `Tile ${next}`, hue: (next * 47) % 360 };
	next += 1;
	return tile;
};

/** Runs a change in a view transition typed `gallery`, as the CSS expects. */
const animateGallery = (update: () => void) =>
	viewTransition(update, { types: ["gallery"] });

const gallery = defineStore({
	state: {
		tiles: Array.from({ length: 8 }, createTile),
	},
	actions: ({ setState }) => ({
		shuffle: () =>
			animateGallery(() =>
				setState((state) => {
					for (let index = state.tiles.length - 1; index > 0; index -= 1) {
						const other = Math.floor(Math.random() * (index + 1));
						const tile = state.tiles[index] as Tile;
						state.tiles[index] = state.tiles[other] as Tile;
						state.tiles[other] = tile;
					}
				}),
			),
		sort: () =>
			animateGallery(() =>
				setState((state) => {
					state.tiles.sort(
						(left, right) =>
							Number(left.label.slice(5)) - Number(right.label.slice(5)),
					);
				}),
			),
		add: () =>
			animateGallery(() =>
				setState((state) => {
					state.tiles.splice(
						Math.floor(Math.random() * (state.tiles.length + 1)),
						0,
						createTile(),
					);
				}),
			),
		replace: () => {
			animateGallery(() =>
				setState((state) => {
					state.tiles = state.tiles.map((tile) => ({ ...tile }));
				}),
			);
			log.info("Replaced every tile with a copy, so the list cross-fades");
		},
		remove: (_event: Event, { index }: LoopItem<Tile>) =>
			setState((state) => {
				state.tiles.splice(index, 1);
			}),
	}),
});

// --------------------------------------------------------
// Layout

const layout = defineStore({
	state: { grid: true },
	computed: ({ state }) => ({
		label: () => (state.grid ? "Show as list" : "Show as grid"),
	}),
	actions: ({ setState }) => ({
		toggleLayout: () =>
			setState((state) => {
				state.grid = !state.grid;
			}),
	}),
});

// --------------------------------------------------------
// Types

const TITLES = ["Your details", "Delivery", "Payment", "Review"];

const steps = defineStore({
	state: { index: 0 },
	computed: ({ state }) => ({
		number: () => state.index + 1,
		title: () => TITLES[state.index] ?? "",
		isFirst: () => state.index === 0,
		isLast: () => state.index === TITLES.length - 1,
	}),
	actions: ({ setState }) => {
		const go = (change: number, type: string) =>
			viewTransition(
				() =>
					setState((state) => {
						state.index += change;
					}),
				{ types: [type] },
			);
		return {
			next: () => go(1, "forward"),
			back: () => go(-1, "backward"),
		};
	},
});

// --------------------------------------------------------
// Removing

const banner = defineStore({
	state: { shown: true },
	computed: ({ state }) => ({
		label: () => (state.shown ? "Dismiss" : "Show banner"),
	}),
	actions: ({ setState }) => ({
		toggle: () =>
			setState((state) => {
				state.shown = !state.shown;
			}),
	}),
});

// --------------------------------------------------------
// Timing

const timing = defineStore({
	state: { count: 0 },
	actions: ({ state, setState }) => ({
		increment: async () => {
			const transition = viewTransition(
				() =>
					setState((draft) => {
						draft.count += 1;
					}),
				{ types: ["timing"] },
			);
			log.info(`Straight after viewTransition: count is ${state.count}`);
			await transition?.updateCallbackDone;
			log.info(`After updateCallbackDone: count is ${state.count}`);
		},
	}),
});

// --------------------------------------------------------
// CSS

const cssPanel = defineStore({
	state: { shown: false },
	computed: ({ state }) => ({ hidden: () => !state.shown }),
	actions: ({ setState }) => ({
		toggle: () =>
			setState((state) => {
				state.shown = !state.shown;
			}),
	}),
});

initCatalyst({
	stores: { support, gallery, layout, steps, banner, timing, cssPanel },
});
