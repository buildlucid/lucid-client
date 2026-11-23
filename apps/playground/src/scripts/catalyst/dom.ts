import { defineStore, flush } from "@lucidclient/catalyst";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --------------------------------------------------------
// Text

const text = defineStore({
	state: { name: "Ada" },
	computed: ({ state }) => ({
		upper: () => state.name.toUpperCase(),
	}),
	actions: ({ setState }) => ({
		setName: (event: Event) => {
			if (!(event.currentTarget instanceof HTMLInputElement)) return;
			const value = event.currentTarget.value;
			setState((state) => {
				state.name = value;
			});
		},
	}),
});

// --------------------------------------------------------
// Rendering values

const VALUES: Record<string, unknown> = {
	string: "plain text",
	number: 42,
	zero: 0,
	boolean: false,
	null: null,
	undefined: undefined,
	object: { id: 1, tags: ["a", "b"] },
	array: [1, "two", null],
};

const rendering = defineStore({
	state: { value: "plain text" as unknown, chosen: "string" },
	actions: ({ setState }) => ({
		choose: (event: Event) => {
			const name =
				event.currentTarget instanceof HTMLElement
					? (event.currentTarget.dataset.valueName ?? "string")
					: "string";
			setState((state) => {
				state.value = VALUES[name];
				state.chosen = name;
			});
		},
	}),
});

// --------------------------------------------------------
// HTML

const htmlLog = createLogger("html");
const html = defineStore({
	state: { count: 1 },
	actions: ({ state, setState }) => ({
		addItem: () =>
			setState((draft) => {
				draft.count += 1;
			}),
		renderList: () => {
			const items = Array.from(
				{ length: state.count },
				(_, index) =>
					`<li class="rounded bg-raised px-2 py-1">Item <strong>${index + 1}</strong></li>`,
			).join("");
			return `<ul class="space-y-1">${items}</ul><button class="btn btn-sm mt-3" data-events--click="@fromInsertedHtml">Inserted button</button>`;
		},
		fromInsertedHtml: () => htmlLog.warn("The inserted button ran an action"),
	}),
});

// --------------------------------------------------------
// Form values

const values = defineStore({
	state: { query: "apple", notes: "Line one", size: "m" },
	actions: ({ setState }) => ({
		setQuery: (event: Event) => {
			if (!(event.currentTarget instanceof HTMLInputElement)) return;
			const value = event.currentTarget.value;
			setState((state) => {
				state.query = value;
			});
		},
		setNotes: (event: Event) => {
			if (!(event.currentTarget instanceof HTMLTextAreaElement)) return;
			const value = event.currentTarget.value;
			setState((state) => {
				state.notes = value;
			});
		},
		setSize: (event: Event) => {
			if (!(event.currentTarget instanceof HTMLSelectElement)) return;
			const value = event.currentTarget.value;
			setState((state) => {
				state.size = value;
			});
		},
		fillExample: () =>
			setState((state) => {
				state.query = "banana";
				state.notes = "Filled from state\nwith two lines";
				state.size = "l";
			}),
		clearAll: () =>
			setState((state) => {
				state.query = "";
				state.notes = "";
				state.size = "s";
			}),
	}),
});

// --------------------------------------------------------
// One-way and two-way values

const oneWayLog = createLogger("one-way value");
const oneWay = defineStore({
	state: { oneWay: "apple", twoWay: "apple" },
	actions: ({ setState }) => ({
		resetOneWay: () => {
			setState((state) => {
				state.oneWay = "apple";
				state.twoWay = "apple";
			});
			oneWayLog.info('Set oneWay and twoWay to "apple"');
		},
		setOneWayPear: () => {
			setState((state) => {
				state.oneWay = "pear";
				state.twoWay = "pear";
			});
			oneWayLog.info('Set oneWay and twoWay to "pear"');
		},
	}),
});

// --------------------------------------------------------
// Checked

const checkedLog = createLogger("checked");
const checked = defineStore({
	state: { subscribed: false },
	actions: ({ state, setState }) => ({
		toggle: () => {
			setState((draft) => {
				draft.subscribed = !draft.subscribed;
			});
			checkedLog.info(`Set subscribed to ${!state.subscribed}`);
		},
		fromField: (event: Event) => {
			const box = event.target;
			if (!(box instanceof HTMLInputElement)) return;
			setState((draft) => {
				draft.subscribed = box.checked;
			});
		},
	}),
});

// --------------------------------------------------------
// Focus

const focusLog = createLogger("focus");
const focus = defineStore({
	state: { editing: false },
	actions: ({ setState }) => ({
		startEditing: () =>
			setState((state) => {
				state.editing = true;
			}),
		stopEditing: () => {
			setState((state) => {
				state.editing = false;
			});
			focusLog.info("Field blurred, editing = false");
		},
	}),
});

// --------------------------------------------------------
// Blur

const blurLog = createLogger("blur");
const blur = defineStore({
	state: { locked: false, countdown: "" },
	actions: ({ setState, refs }) => ({
		focusThenLock: async () => {
			setState((state) => {
				state.locked = false;
				state.countdown = "locking in 1.5s…";
			});
			refs.get<HTMLInputElement>("field")?.focus();
			await delay(1500);
			setState((state) => {
				state.locked = true;
				state.countdown = "locked";
			});
			// Apply the write now, so the log reads focus after the blur.
			flush();
			blurLog.info("locked = true", {
				activeElement: document.activeElement,
			});
		},
		unlock: () =>
			setState((state) => {
				state.locked = false;
				state.countdown = "";
			}),
	}),
});

// --------------------------------------------------------
// Scroll to

const scroll = defineStore({
	state: { target: 0 },
	computed: ({ state }) => ({
		atFirst: () => state.target === 1,
		atMiddle: () => state.target === 6,
		atLast: () => state.target === 12,
	}),
	actions: ({ setState }) => ({
		scrollTo: (event: Event) => {
			const target =
				event.currentTarget instanceof HTMLElement
					? Number(event.currentTarget.dataset.scrollTarget)
					: 0;
			// scrollto acts when the value becomes true, so clear it first to
			// scroll to the same item again.
			setState((state) => {
				state.target = 0;
			});
			flush();
			setState((state) => {
				state.target = target;
			});
		},
	}),
});

// --------------------------------------------------------
// Async action values

const asyncLog = createLogger("async");
let run = 0;
const asyncValue = defineStore({
	state: { name: "Ada" },
	actions: ({ state, setState }) => ({
		setName: (event: Event) => {
			if (!(event.currentTarget instanceof HTMLInputElement)) return;
			const value = event.currentTarget.value;
			setState((draft) => {
				draft.name = value;
			});
		},
		slowGreeting: async () => {
			// Read before awaiting, so the binding tracks it.
			const name = state.name;
			const id = ++run;
			const wait = 400 + Math.round(Math.random() * 900);
			asyncLog.info(`#${id} started for "${name}" (${wait}ms)`);
			await delay(wait);
			asyncLog.info(`#${id} resolved for "${name}"`);
			return `Hello, ${name || "stranger"}!`;
		},
	}),
});

// --------------------------------------------------------
// Misconfigured

const misconfigured = defineStore({
	state: { name: "Ada" },
});

startCatalyst({
	stores: {
		text,
		rendering,
		html,
		values,
		oneWay,
		checked,
		focus,
		blur,
		scroll,
		asyncValue,
		misconfigured,
	},
});
