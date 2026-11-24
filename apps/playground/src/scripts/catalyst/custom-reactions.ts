import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { stringifyState } from "@lucidclient/catalyst/helpers";
import type { Reaction } from "@lucidclient/catalyst/types";
import { createEffect } from "solid-js";
import { allReactions, initCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("reactions");

// Classes these reactions add at runtime, listed so Tailwind generates them.
export const RUNTIME_CLASSES = [
	"ring-2",
	"ring-accent",
	"ring-offset-2",
	"ring-offset-canvas",
	"opacity-40",
	"italic",
	"text-accent",
];

// --------------------------------------------------------
// classList: a literal value, as in the README

const classList: Reaction = {
	name: "classList",
	attribute: "class-list",
	setup: ({ element, value, reference, attributeName, specifier }) => {
		log.info("classList setup", {
			attributeName,
			specifier,
			value,
			reference,
		});
		const classes = value.split(/\s+/).filter(Boolean);
		element.classList.add(...classes);
		return () => {
			element.classList.remove(...classes);
			log.info(`classList cleanup removed "${classes.join(" ")}"`);
		};
	},
};

// --------------------------------------------------------
// toggle-class: toggles the class named by the specifier while the value is
// truthy, like a simpler first-party data-class--{name}

const toggleClass: Reaction = {
	name: "toggleClass",
	attribute: "toggle-class",
	setup: (directive, context) => {
		const { element, specifier, reference } = directive;
		if (!specifier) {
			context.warn(
				`The "${directive.attributeName}" directive needs a class name: data-toggle-class--{name}.`,
			);
			return;
		}
		if (!reference || reference.type === "identifier") {
			context.warn(
				`The "${directive.attributeName}" directive requires state or an action.`,
			);
			return;
		}
		// Solid 2's two-phase effect: the first function is tracked, the second
		// applies the result untracked.
		createEffect(
			() => Boolean(context.resolve(reference)),
			(active) => {
				element.classList.toggle(specifier, active);
			},
		);
		return undefined;
	},
};

// --------------------------------------------------------
// css-var: writes a CSS custom property from state or an action

const cssVar: Reaction = {
	name: "cssVar",
	attribute: "css-var",
	setup: (directive, context) => {
		const { element, specifier, reference, value } = directive;
		if (!specifier) {
			context.warn(
				`The "${directive.attributeName}" directive needs a property name: data-css-var--{name}.`,
			);
			return;
		}
		if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
			return;
		}
		const property = `--${specifier}`;
		if (!reference) {
			element.style.setProperty(property, value);
			return () => element.style.removeProperty(property);
		}
		createEffect(
			() => context.resolve(reference),
			(next) => {
				if (next === null || next === undefined) {
					element.style.removeProperty(property);
				} else {
					element.style.setProperty(property, stringifyState(next));
				}
			},
		);
		return () => element.style.removeProperty(property);
	},
};

// --------------------------------------------------------
// inspect: reads another store through context.getStore

const inspect: Reaction = {
	name: "inspect",
	attribute: "inspect",
	setup: (directive, context) => {
		const scope = directive.value;
		const store = context.getStore(scope);
		if (!store) {
			context.warn(
				`data-inspect: there is no store with the scope "${scope}".`,
			);
			return;
		}
		log.info(`inspect read store "${store.key}" with context.getStore`, {
			key: store.key,
			element: store.element,
			actions: Object.keys(store.actions),
		});
		createEffect(
			// JSON.stringify reads every value, so every change re-runs it.
			() => JSON.stringify(store.state, null, 2),
			(json) => {
				directive.element.textContent = `// context.getStore("${store.key}")\nactions: ${Object.keys(store.actions).join(", ")}\nstate: ${json}`;
			},
		);
		return undefined;
	},
};

// --------------------------------------------------------
// clock: a timer cleaned up with the directive

let clockIds = 0;
const clock: Reaction = {
	name: "clock",
	attribute: "clock",
	setup: ({ element, value }) => {
		const id = ++clockIds;
		const interval = Math.max(100, Number(value) || 1000);
		const render = () => {
			element.textContent = new Date().toLocaleTimeString("en-GB");
		};
		render();
		const timer = setInterval(render, interval);
		log.success(`clock #${id} started, ticking every ${interval}ms`);
		return () => {
			clearInterval(timer);
			log.info(`clock #${id} cleanup cleared its interval`);
		};
	},
};

// --------------------------------------------------------
// Conflicting registrations

const duplicateAttribute: Reaction = {
	name: "classListCopy",
	attribute: "class-list",
	setup: () => undefined,
};

const duplicateName: Reaction = {
	name: "bind",
	attribute: "bind-again",
	setup: () => undefined,
};

// --------------------------------------------------------
// Stores

const literal = defineStore({
	actions: ({ refs }) => ({
		toggleAttribute: () => {
			const target = refs.get("target");
			if (!target) return;
			if (target.hasAttribute("data-class-list")) {
				target.removeAttribute("data-class-list");
				log.info("Removed data-class-list and synced");
			} else {
				target.setAttribute("data-class-list", "italic text-accent");
				log.info('Set data-class-list="italic text-accent" and synced');
			}
			Catalyst.sync(target);
		},
	}),
});

const options = defineStore({
	state: { selected: "starter" as "starter" | "team" | "scale", muted: false },
	computed: ({ state }) => ({
		isStarter: () => state.selected === "starter",
		isTeam: () => state.selected === "team",
		isScale: () => state.selected === "scale",
	}),
	actions: ({ setState }) => ({
		select: (event: Event) => {
			const plan = (event.currentTarget as HTMLElement).dataset.plan;
			if (plan !== "starter" && plan !== "team" && plan !== "scale") return;
			setState((state) => {
				state.selected = plan;
			});
		},
		toggleMuted: () =>
			setState((state) => {
				state.muted = !state.muted;
			}),
	}),
});

const progress = defineStore({
	state: { percent: 40 },
	computed: ({ state }) => ({
		label: () => `${state.percent}%`,
	}),
	actions: ({ state, setState }) => ({
		setPercent: (event: Event) => {
			const input = event.currentTarget as HTMLInputElement;
			setState((draft) => {
				draft.percent = Number(input.value);
			});
		},
		// Read by data-css-var--hue, so the reaction resolves an action.
		hue: () => Math.round(25 + (state.percent / 100) * 120),
	}),
});

const basket = defineStore({
	state: { items: [] as string[] },
	actions: ({ state, setState }) => ({
		addItem: () =>
			setState((draft) => {
				draft.items.push(`item ${state.items.length + 1}`);
			}),
		clear: () =>
			setState((draft) => {
				draft.items = [];
			}),
	}),
});

const clocks = defineStore({
	actions: ({ refs }) => ({
		addClock: () => {
			const list = refs.get("list");
			if (!list) return;
			const item = document.createElement("li");
			item.className =
				"rounded-md bg-raised px-3 py-1.5 font-mono text-sm tabular-nums";
			item.setAttribute("data-clock", "500");
			list.append(item);
			Catalyst.sync(item);
		},
		removeClock: () => {
			refs.get("list")?.lastElementChild?.remove();
		},
	}),
});

initCatalyst({
	stores: { literal, options, progress, basket, clocks },
	reactions: [
		...allReactions,
		classList,
		toggleClass,
		cssVar,
		inspect,
		clock,
		duplicateAttribute,
		duplicateName,
	],
});
