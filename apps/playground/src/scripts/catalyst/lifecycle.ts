import Catalyst, { defineStore, untrack } from "@lucidclient/catalyst";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const inputValue = (event: Event) =>
	event.target instanceof HTMLInputElement ? event.target.value : "";

// --------------------------------------------------------
// Effects track what their compute reads

const trackingLog = createLogger("tracking");
const tracking = defineStore({
	state: { query: "", count: 0 },
	actions: ({ setState }) => ({
		setQuery: (event: Event) =>
			setState((state) => {
				state.query = inputValue(event);
			}),
		bumpCount: () =>
			setState((state) => {
				state.count += 1;
			}),
	}),
	effects: ({ state, effect }) => ({
		logQuery: effect(
			() => state.query,
			(query, { isInitial, previous }) => {
				trackingLog.info("logQuery ran", { query, previous, isInitial });
			},
		),
	}),
});

// --------------------------------------------------------
// Cleanups run before the next run

const autosaveLog = createLogger("autosave");
const autosave = defineStore({
	state: { draft: "", saved: "", pending: false },
	computed: ({ state }) => ({
		statusLabel: () =>
			state.pending
				? "Saving soon…"
				: state.saved
					? `Saved "${state.saved}"`
					: "Nothing saved yet",
	}),
	actions: ({ setState }) => ({
		setDraft: (event: Event) =>
			setState((state) => {
				state.draft = inputValue(event);
			}),
	}),
	effects: ({ state, setState, effect }) => {
		let cancelled = 0;
		return {
			save: effect(
				() => state.draft,
				(draft, { isInitial }) => {
					if (isInitial) return;
					setState((draftState) => {
						draftState.pending = true;
					});
					let fired = false;
					const timer = setTimeout(() => {
						fired = true;
						setState((draftState) => {
							draftState.saved = draft;
							draftState.pending = false;
						});
						autosaveLog.success(`Saved "${draft}"`, {
							pendingSavesCancelled: cancelled,
						});
						cancelled = 0;
					}, 700);
					return () => {
						clearTimeout(timer);
						if (!fired) cancelled += 1;
					};
				},
			),
		};
	},
});

// --------------------------------------------------------
// An effect that owns an interval

const tickerLog = createLogger("ticker");
const ticker = defineStore({
	state: { running: false, ticks: 0 },
	computed: ({ state }) => ({
		buttonLabel: () => (state.running ? "Stop" : "Start"),
		seconds: () => (state.ticks / 10).toFixed(1),
	}),
	actions: ({ setState }) => ({
		toggle: () =>
			setState((state) => {
				state.running = !state.running;
			}),
		reset: () =>
			setState((state) => {
				state.ticks = 0;
			}),
	}),
	effects: ({ state, setState, effect }) => ({
		interval: effect(
			() => state.running,
			(running) => {
				if (!running) return;
				const id = setInterval(() => {
					setState((draft) => {
						draft.ticks += 1;
					});
				}, 100);
				tickerLog.info("Interval started");
				return () => {
					clearInterval(id);
					tickerLog.info("Cleanup cleared the interval");
				};
			},
		),
	}),
});

// --------------------------------------------------------
// A failing effect is isolated

const effectsLog = createLogger("effects");
const fragile = defineStore({
	state: { value: 0 },
	actions: ({ setState }) => ({
		bump: () =>
			setState((state) => {
				state.value += 1;
			}),
	}),
	effects: ({ state, effect }) => ({
		throwsOnOdd: effect(
			() => state.value,
			(value) => {
				if (value % 2 === 1) {
					throw new Error(`throwsOnOdd threw for ${value}`);
				}
				effectsLog.info(`throwsOnOdd ran for ${value}`);
			},
		),
		computeThrowsFromThree: effect(
			() => {
				if (state.value >= 3) {
					throw new Error(`The compute threw for ${state.value}`);
				}
				return state.value;
			},
			(value) => effectsLog.info(`computeThrowsFromThree ran for ${value}`),
		),
		steady: effect(
			() => state.value,
			(value) => effectsLog.success(`steady ran for ${value}`),
		),
		// Not created with the effect helper, so Catalyst warns and skips it.
		notAnEffect: (() => {}) as never,
	}),
});

// --------------------------------------------------------
// Reading other state in an effect callback

const readsLog = createLogger("callback reads");
const reads = defineStore({
	state: { count: 0, label: "first label" },
	actions: ({ setState }) => ({
		bump: () =>
			setState((state) => {
				state.count += 1;
			}),
		changeLabel: () =>
			setState((state) => {
				state.label =
					state.label === "first label" ? "second label" : "first label";
			}),
	}),
	effects: ({ state, effect }) => ({
		direct: effect(
			() => state.count,
			(count, { isInitial }) => {
				if (isInitial) return;
				readsLog.info(`direct read for count ${count}: ${state.label}`);
			},
		),
		withUntrack: effect(
			() => state.count,
			(count, { isInitial }) => {
				if (isInitial) return;
				readsLog.info(
					`untrack read for count ${count}: ${untrack(() => state.label)}`,
				);
			},
		),
	}),
});

// --------------------------------------------------------
// init and its cleanup

const widgetLog = createLogger("widget");
const widget = defineStore({
	state: { width: 0 },
	actions: ({ setState }) => ({
		setWidth: (width: number) =>
			setState((state) => {
				state.width = width;
			}),
	}),
	init: ({ refs, actions }) => {
		const box = refs.get("box");
		widgetLog.info("init ran and started a ResizeObserver", {
			boxRef: box ? "found" : "missing",
		});
		const observer = new ResizeObserver(([entry]) => {
			if (entry) actions.setWidth(Math.round(entry.contentRect.width));
		});
		if (box) observer.observe(box);
		return () => {
			observer.disconnect();
			widgetLog.info("init's cleanup disconnected the observer");
		};
	},
});

// --------------------------------------------------------
// An async init

const profileLog = createLogger("async init");
let profileInstances = 0;
const asyncProfile = defineStore({
	state: () => ({
		instance: ++profileInstances,
		status: "loading" as "loading" | "ready",
		name: "",
	}),
	computed: ({ state }) => ({
		loading: () => state.status === "loading",
		ready: () => state.status === "ready",
	}),
	init: async ({ state, setState }) => {
		const instance = state.instance;
		profileLog.info(`init started for instance ${instance}`);
		await wait(900);
		setState((draft) => {
			draft.status = "ready";
			draft.name = `Ada Lovelace (instance ${instance})`;
		});
		profileLog.success(`init finished for instance ${instance}`);
		return () => profileLog.info(`cleanup ran for instance ${instance}`);
	},
});

// --------------------------------------------------------
// Refs

const refsLog = createLogger("refs");
const refsDemo = defineStore({
	state: { rows: [1, 2] },
	actions: ({ refs, setState }) => ({
		focusInput: () => refs.get<HTMLInputElement>("nameInput")?.focus(),
		highlightItems: () => {
			for (const item of refs.all("items")) {
				item.toggleAttribute("data-highlighted");
			}
		},
		countRefs: () =>
			refsLog.info("Registered refs", {
				nameInput: refs.get("nameInput") ? 1 : 0,
				items: refs.all("items").length,
				rows: refs.all("rows").length,
			}),
		addRow: () =>
			setState((state) => {
				state.rows.push(state.rows.length + 1);
			}),
		removeRow: () =>
			setState((state) => {
				state.rows.pop();
			}),
	}),
	init: ({ refs }) => {
		refsLog.info("Refs are available in init", {
			nameInput: refs.get("nameInput")?.localName,
			items: refs.all("items").length,
		});
	},
});

startCatalyst({
	stores: {
		tracking,
		autosave,
		ticker,
		fragile,
		reads,
		widget,
		asyncProfile,
		refsDemo,
	},
});

// --------------------------------------------------------
// Plain JavaScript controls for the lifecycle scenarios

const widgetElement = document.querySelector("[data-store='widget']");
const widgetSlot = widgetElement?.parentElement;

const lifecycleActions: Record<string, () => void> = {
	"refresh-widget": () => Catalyst.refresh("widget"),
	"remove-widget": () => widgetElement?.remove(),
	"restore-widget": () => {
		if (!widgetElement || !widgetSlot || widgetElement.isConnected) return;
		widgetSlot.prepend(widgetElement);
		Catalyst.sync(widgetSlot);
	},
	"refresh-profile": () => Catalyst.refresh("asyncProfile"),
	"refresh-profile-twice": () => {
		Catalyst.refresh("asyncProfile");
		Catalyst.refresh("asyncProfile");
	},
};

for (const button of document.querySelectorAll<HTMLElement>(
	"[data-lifecycle-action]",
)) {
	button.addEventListener("click", () => {
		lifecycleActions[button.dataset.lifecycleAction ?? ""]?.();
	});
}
