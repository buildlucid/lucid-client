import Catalyst, { defineStore } from "@lucidclient/catalyst";
import type { LoopItem } from "@lucidclient/catalyst/types";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("classes");

// --------------------------------------------------------
// One class

const oneClass = defineStore({
	state: { open: false, muted: false },
	actions: ({ setState }) => ({
		toggleOpen: () =>
			setState((state) => {
				state.open = !state.open;
			}),
		toggleMuted: () =>
			setState((state) => {
				state.muted = !state.muted;
			}),
	}),
});

// --------------------------------------------------------
// Strings, arrays and objects

const lists = defineStore({
	state: {
		classes: null as string | string[] | Record<string, boolean> | null,
	},
	computed: ({ state }) => ({
		described: () => `classes = ${JSON.stringify(state.classes)}`,
	}),
	actions: ({ setState }) => {
		const use = (classes: string | string[] | Record<string, boolean> | null) =>
			setState((state) => {
				state.classes = classes;
			});
		return {
			useString: () => use("border-accent text-accent"),
			useArray: () => use(["bg-raised", "font-semibold"]),
			useObject: () => use({ italic: true, underline: false }),
			useNull: () => use(null),
		};
	},
});

// --------------------------------------------------------
// Loop items

const tabs = defineStore({
	state: { tabs: ["Overview", "Activity", "Settings"], selected: "Overview" },
	actions: ({ state, setState }) => ({
		tabClass: ({ item }: LoopItem<string>) => ({
			"bg-accent/15 text-accent font-medium": item === state.selected,
		}),
		isSelected: ({ item }: LoopItem<string>) => item === state.selected,
		select: (_event: Event, { item }: LoopItem<string>) => {
			setState((draft) => {
				draft.selected = item;
			});
			log.info(`Selected ${item}`);
		},
	}),
});

// --------------------------------------------------------
// Restore

const restore = defineStore({
	state: { on: false },
	actions: ({ setState }) => ({
		toggle: () =>
			setState((state) => {
				state.on = !state.on;
			}),
	}),
});

const misconfiguredClasses = defineStore({
	state: { count: 3, on: true },
});

startCatalyst({
	stores: { oneClass, lists, tabs, restore, misconfiguredClasses },
});

// --------------------------------------------------------
// Plain JavaScript

// Shows the live `class` attribute of an element, or of each child of a list.
for (const output of document.querySelectorAll<HTMLElement>(
	"[data-class-readout]",
)) {
	const target = document.querySelector(output.dataset.classReadout ?? "");
	if (!target) continue;
	const render = () => {
		const elements =
			target.getAttribute("role") === "tablist"
				? Array.from(target.querySelectorAll("[role=tab]"))
				: [target];
		output.textContent = elements
			.map((element) => `class="${element.getAttribute("class") ?? ""}"`)
			.join("\n");
	};
	render();
	new MutationObserver(render).observe(target, {
		attributes: true,
		attributeFilter: ["class"],
		subtree: true,
		childList: true,
	});
}

document
	.querySelector("[data-remove-directive]")
	?.addEventListener("click", (event) => {
		const note = document.querySelector("#classes-note");
		note?.removeAttribute("data-class--highlighted");
		if (note) Catalyst.sync(note);
		if (event.currentTarget instanceof HTMLButtonElement) {
			event.currentTarget.disabled = true;
		}
		log.info("Removed data-class--highlighted and synced");
	});
