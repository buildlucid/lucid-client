import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

// --------------------------------------------------------
// A number, with the unit added in CSS

const progress = defineStore({
	state: { percent: 40 },
	computed: ({ state }) => ({
		label: () => `${state.percent}%`,
	}),
	actions: ({ setState }) => ({
		advance: () =>
			setState((state) => {
				state.percent = state.percent >= 100 ? 0 : state.percent + 20;
			}),
	}),
});

// --------------------------------------------------------
// A colour from a computed value

const theme = defineStore({
	state: { hue: 277 },
	computed: ({ state }) => ({
		accent: () => `oklch(0.76 0.12 ${state.hue})`,
	}),
});

// --------------------------------------------------------
// Staggered loop items

type StaggerItem = { id: number; label: string };

const LABELS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];
let nextId = 0;
const createItem = (label: string): StaggerItem => ({ id: nextId++, label });

const stagger = defineStore({
	state: { items: LABELS.slice(0, 4).map(createItem) },
	actions: ({ setState }) => ({
		reverse: () =>
			setState((state) => {
				state.items.reverse();
			}),
		add: () =>
			setState((state) => {
				const label = LABELS[state.items.length % LABELS.length] ?? "Item";
				state.items.push(createItem(label));
			}),
		removeFirst: () =>
			setState((state) => {
				state.items.shift();
			}),
		// New objects, so every item renders again and animates in.
		replay: () =>
			setState((state) => {
				state.items = state.items.map((item) => createItem(item.label));
			}),
	}),
});

// --------------------------------------------------------
// Booleans for style queries

const toggle = defineStore({
	state: { open: false },
	actions: ({ setState }) => ({
		toggle: () =>
			setState((state) => {
				state.open = !state.open;
			}),
	}),
});

// --------------------------------------------------------
// Nullish, empty and invalid values

const valuesLog = createLogger("values");
const VALUES: Record<string, unknown> = {
	colour: "tomato",
	number: 12,
	zero: 0,
	true: true,
	false: false,
	empty: "",
	null: null,
	undefined: undefined,
	object: { color: "tomato" },
	array: ["tomato"],
};

const values = defineStore({
	state: { value: "tomato" as unknown },
	actions: ({ setState }) => ({
		setValue: (event: Event) => {
			const name =
				event.currentTarget instanceof HTMLElement
					? (event.currentTarget.dataset.valueName ?? "colour")
					: "colour";
			const next = VALUES[name];
			setState((state) => {
				state.value = next;
			});
			valuesLog.info(`value = ${name}`);
		},
	}),
});

// --------------------------------------------------------
// Server-rendered values and disposal

const restoreLog = createLogger("restore");
const ATTRIBUTE = "data-css--size";

const restore = defineStore({
	state: { rem: 2, attached: true },
	computed: ({ state }) => ({
		size: () => `${state.rem}rem`,
		detached: () => !state.attached,
	}),
	actions: ({ setState, refs }) => ({
		grow: () =>
			setState((state) => {
				state.rem = state.rem >= 4 ? 1.5 : state.rem + 0.5;
			}),
		removeDirective: () => {
			const target = refs.get("target");
			if (!target) return;
			target.removeAttribute(ATTRIBUTE);
			Catalyst.sync(target);
			setState((state) => {
				state.attached = false;
			});
			restoreLog.info(`Removed ${ATTRIBUTE} and synced`);
		},
		addDirective: () => {
			const target = refs.get("target");
			if (!target) return;
			target.setAttribute(ATTRIBUTE, "$size");
			Catalyst.sync(target);
			setState((state) => {
				state.attached = true;
			});
			restoreLog.info(`Added ${ATTRIBUTE} and synced`);
		},
	}),
});

// --------------------------------------------------------
// Misconfigured directives

const misconfigured = defineStore({
	state: { size: "2rem" },
});

startCatalyst({
	stores: {
		progress,
		theme,
		stagger,
		toggle,
		values,
		restore,
		misconfigured,
	},
});
