import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { initCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("scopes");

// --------------------------------------------------------
// Nested stores

/** Each level has a `rename` action, so `@rename` shows which store it hit. */
const renamable = (initial: string, alternate: string) =>
	defineStore({
		state: { name: initial },
		actions: ({ state, setState }) => ({
			rename: () => {
				setState((draft) => {
					draft.name = draft.name === initial ? alternate : initial;
				});
				log.info(`rename ran on the store named "${state.name}"`);
			},
		}),
	});

const outer = renamable("Outer", "Outer (renamed)");
const inner = renamable("Inner", "Inner (renamed)");
const innermost = renamable("Innermost", "Innermost (renamed)");

// --------------------------------------------------------
// References from outside a store

const profile = defineStore({
	state: { name: "Ada", visits: 0 },
	computed: ({ state }) => ({
		greeting: () => `Hello, ${state.name}`,
	}),
	actions: ({ state, setState, refs }) => ({
		rename: () =>
			setState((draft) => {
				draft.name = draft.name === "Ada" ? "Grace" : "Ada";
			}),
		visit: () =>
			setState((draft) => {
				draft.visits += 1;
			}),
		flashBadge: () => {
			const badge = refs.get("badge");
			badge?.toggleAttribute("data-highlighted");
			log.info("profile reached a ref registered outside its element", {
				badge: badge ? "found" : "missing",
				name: state.name,
			});
		},
	}),
});

const toolbar = defineStore({
	state: { title: "Toolbar" },
});

// --------------------------------------------------------
// Duplicate scopes

const duplicate = defineStore({
	state: { label: "default" },
	actions: ({ state }) => ({
		report: () => log.info(`duplicate store answered with "${state.label}"`),
	}),
});

// --------------------------------------------------------
// A store that appears later

const late = defineStore({
	state: { message: "default message", pings: 0 },
	actions: ({ setState }) => ({
		ping: () => {
			// Writes apply on the next microtask, so the count is read from the draft.
			let pings = 0;
			setState((draft) => {
				draft.pings += 1;
				pings = draft.pings;
			});
			log.info(`late store pinged (${pings})`);
		},
	}),
	init: ({ state }) => {
		log.info(`late store created with "${state.message}"`);
		return () => log.info("late store destroyed");
	},
});

initCatalyst({
	stores: { outer, inner, innermost, profile, toolbar, duplicate, late },
});

// --------------------------------------------------------
// Adding and removing the late store with plain JavaScript

const slot = document.querySelector<HTMLElement>("[data-scopes-late-slot]");
let added = 0;

document
	.querySelector("[data-scopes-add-late]")
	?.addEventListener("click", () => {
		if (!slot || slot.querySelector("[data-store='late']")) return;
		added += 1;
		slot.innerHTML = `
			<div data-store="late" data-state--message="Added after init (${added})" class="flex items-center gap-3 rounded-md bg-raised px-3 py-2">
				<span class="text-sm" data-dom--text="$message"></span>
				<span class="ml-auto font-mono text-xs text-subtle">pings <span data-dom--text="$pings"></span></span>
			</div>`;
		Catalyst.sync(slot);
	});

document
	.querySelector("[data-scopes-remove-late]")
	?.addEventListener("click", () => {
		slot?.replaceChildren();
	});
