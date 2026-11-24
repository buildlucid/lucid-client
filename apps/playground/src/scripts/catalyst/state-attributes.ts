import Catalyst, { defineStore } from "@lucidclient/catalyst";
import { initCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

/** "number · 3", "string · \"007\"", "array · [false,\"world\"]" */
const describe = (value: unknown) => {
	const type =
		value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
	const text = value === undefined ? "undefined" : JSON.stringify(value);
	return `${type} · ${text}`;
};

/** Describes every state value, keyed by name, for `$types.key` bindings. */
const describeAll = (state: Readonly<Record<string, unknown>>) =>
	Object.fromEntries(
		Object.keys(state)
			.filter((key) => key !== "types")
			.map((key) => [key, describe(state[key])]),
	);

// --------------------------------------------------------
// Inferred types, without defaults

const inferred = defineStore({
	computed: ({ state }) => ({
		types: () => describeAll(state as Record<string, unknown>),
	}),
});

// --------------------------------------------------------
// Defaults decide the type

const typed = defineStore({
	state: {
		visits: 0,
		code: "",
		enabled: false,
		tags: [] as string[],
		notInMarkup: "declared in the definition only",
	},
	computed: ({ state }) => ({
		types: () => describeAll(state),
	}),
});

// --------------------------------------------------------
// Kebab-case attributes and camelCase keys

const naming = defineStore({
	state: { userName: "", displayName: "fallback display name" },
});

// --------------------------------------------------------
// State writes update attributes

const writesLog = createLogger("writes");
const writes = defineStore({
	state: {
		count: 0,
		active: false,
		tags: ["alpha"] as string[],
		profile: { name: "Ada", role: "admin" },
	},
	actions: ({ state, setState }) => ({
		increment: () =>
			setState((draft) => {
				draft.count += 1;
			}),
		toggleActive: () =>
			setState((draft) => {
				draft.active = !draft.active;
			}),
		pushTag: () =>
			setState((draft) => {
				draft.tags.push(`tag-${draft.tags.length + 1}`);
			}),
		renameProfile: () => {
			setState((draft) => {
				draft.profile.name = draft.profile.name === "Ada" ? "Grace" : "Ada";
			});
			writesLog.info("Changed only profile.name", {
				before: state.profile.name,
			});
		},
	}),
});

// --------------------------------------------------------
// Attribute writes update state

const reverse = defineStore({
	state: { count: 0, label: "", flag: false },
	computed: ({ state }) => ({
		types: () => describeAll(state),
	}),
});

// --------------------------------------------------------
// Attributes added after init

const late = defineStore({
	state: { known: "declared default" },
	computed: ({ state }) => ({
		types: () => describeAll(state),
	}),
	actions: ({ setState }) => ({
		changeKnown: () =>
			setState((draft) => {
				draft.known = `changed by an action at ${new Date().toLocaleTimeString("en-GB")}`;
			}),
	}),
});

// --------------------------------------------------------
// Styling from state attributes

const styled = defineStore({
	state: { active: false, level: "low" },
	actions: ({ setState }) => ({
		toggle: () =>
			setState((draft) => {
				draft.active = !draft.active;
			}),
		cycleLevel: () =>
			setState((draft) => {
				draft.level =
					draft.level === "low"
						? "medium"
						: draft.level === "medium"
							? "high"
							: "low";
			}),
	}),
});

initCatalyst({
	stores: { inferred, typed, naming, writes, reverse, late, styled },
});

// --------------------------------------------------------
// Plain JavaScript controls that write attributes from outside Catalyst

const controlsLog = createLogger("attribute controls");

for (const button of document.querySelectorAll<HTMLButtonElement>(
	"[data-attribute-set]",
)) {
	button.addEventListener("click", () => {
		const target = document.querySelector(button.dataset.attributeTarget ?? "");
		const name = button.dataset.attributeSet ?? "";
		const value = button.dataset.attributeValue;
		if (!target || !name) return;
		if (value === undefined) {
			target.removeAttribute(name);
			controlsLog.info(`Removed ${name}`);
		} else {
			target.setAttribute(name, value);
			controlsLog.info(`Set ${name}="${value}"`);
		}
	});
}

const lateElement = document.querySelector("[data-store='late']");
document.querySelector("[data-late-sync]")?.addEventListener("click", () => {
	if (!lateElement) return;
	Catalyst.sync(lateElement);
	controlsLog.info("Ran Catalyst.sync on the late store element");
});
