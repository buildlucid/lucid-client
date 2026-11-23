import { defineStore } from "@lucidclient/catalyst";
import type { LoopItem } from "@lucidclient/catalyst/types";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const describeTarget = (target: EventTarget | null) =>
	target instanceof Element
		? `<${target.localName}>`
		: target === document
			? "document"
			: target === window
				? "window"
				: "nothing";

// --------------------------------------------------------
// Element events

const elementEvents = defineStore({
	state: { last: "Nothing yet", key: "—", scrollTop: 0 },
	actions: ({ setState }) => ({
		onClick: (event: MouseEvent) => {
			const modifiers = [
				event.shiftKey && "Shift",
				event.altKey && "Alt",
				event.metaKey && "Meta",
				event.ctrlKey && "Ctrl",
			].filter(Boolean);
			setState((state) => {
				state.last = `click on ${describeTarget(event.currentTarget)}${modifiers.length ? ` with ${modifiers.join("+")}` : ""} at ${event.offsetX},${event.offsetY}`;
			});
		},
		onInput: (event: InputEvent) => {
			const value =
				event.currentTarget instanceof HTMLInputElement
					? event.currentTarget.value
					: "";
			setState((state) => {
				state.last = `input (${event.inputType || "unknown"}): "${value}"`;
			});
		},
		onKeydown: (event: KeyboardEvent) =>
			setState((state) => {
				state.key = event.key === " " ? "Space" : event.key;
			}),
		onScroll: (event: Event) => {
			const top =
				event.currentTarget instanceof HTMLElement
					? Math.round(event.currentTarget.scrollTop)
					: 0;
			setState((state) => {
				state.scrollTop = top;
			});
		},
	}),
});

// --------------------------------------------------------
// Global targets

const globalTargets = defineStore({
	state: { lastKey: "none", viewport: "", bodyClicks: 0 },
	actions: ({ setState }) => ({
		onDocumentKeydown: (event: KeyboardEvent) =>
			setState((state) => {
				state.lastKey = event.key === " " ? "Space" : event.key;
			}),
		onResize: () =>
			setState((state) => {
				state.viewport = `${window.innerWidth} × ${window.innerHeight}`;
			}),
		onBodyClick: () =>
			setState((state) => {
				state.bodyClicks += 1;
			}),
	}),
	init: ({ setState }) => {
		setState((state) => {
			state.viewport = `${window.innerWidth} × ${window.innerHeight}`;
		});
	},
});

// --------------------------------------------------------
// Shared targets

const pingLog = createLogger("ping");
const createPingStore = (name: string) =>
	defineStore({
		state: { count: 0 },
		actions: ({ state, setState }) => ({
			onPing: () => {
				setState((draft) => {
					draft.count += 1;
				});
				pingLog.info(`${name} ran onPing (count was ${state.count})`);
			},
		}),
	});

// --------------------------------------------------------
// Delegation

const delegationLog = createLogger("delegation");
const delegation = defineStore({
	state: { selected: "none" },
	actions: ({ setState }) => ({
		onListClick: (event: MouseEvent) => {
			const item =
				event.target instanceof Element
					? event.target.closest<HTMLElement>("[data-fruit]")
					: null;
			if (!item) return;
			const fruit = item.dataset.fruit ?? "";
			setState((state) => {
				state.selected = fruit;
			});
			delegationLog.info(`Selected ${fruit}`, {
				target: event.target,
				currentTarget: event.currentTarget,
			});
		},
	}),
});

// --------------------------------------------------------
// Custom events

const customLog = createLogger("custom events");
const custom = defineStore({
	state: { received: "nothing yet" },
	actions: ({ setState }) => ({
		onItemSelected: (event: CustomEvent<{ id: number }>) => {
			setState((state) => {
				state.received = `item-selected with detail.id = ${event.detail?.id}`;
			});
			customLog.success("Received item-selected", event.detail);
		},
		onItemChosen: () => {
			customLog.warn("itemChosen reached its action, which shouldn't happen");
		},
	}),
});

// --------------------------------------------------------
// Async and failing actions

const asyncLog = createLogger("async actions");
const asyncActions = defineStore({
	state: { status: "idle" },
	actions: ({ setState }) => ({
		saveSlowly: async () => {
			setState((state) => {
				state.status = "saving…";
			});
			await delay(800);
			setState((state) => {
				state.status = `saved at ${new Date().toLocaleTimeString("en-GB")}`;
			});
			asyncLog.success("Saved");
		},
		failSlowly: async () => {
			setState((state) => {
				state.status = "failing…";
			});
			await delay(500);
			setState((state) => {
				state.status = "failed (see the log)";
			});
			throw new Error("The async action rejected on purpose");
		},
		throwNow: () => {
			throw new Error("The action threw synchronously on purpose");
		},
	}),
});

// --------------------------------------------------------
// Preventing defaults

const defaultsLog = createLogger("defaults");
const defaults = defineStore({
	state: { prevented: 0 },
	actions: ({ setState }) => ({
		onLinkClick: (event: MouseEvent) => {
			event.preventDefault();
			setState((state) => {
				state.prevented += 1;
			});
			defaultsLog.info("Prevented the link navigation");
		},
		onContextMenu: (event: MouseEvent) => {
			event.preventDefault();
			setState((state) => {
				state.prevented += 1;
			});
			defaultsLog.info("Prevented the context menu");
		},
	}),
});

// --------------------------------------------------------
// Modifiers

const modifiersLog = createLogger("modifiers");
const modifiers = defineStore({
	state: { prevent: 0, stop: 0, once: 0, self: 0, panel: 0 },
	computed: ({ state }) => ({
		summary: () =>
			`prevent ${state.prevent} · stop ${state.stop} · once ${state.once} · self ${state.self} · panel ${state.panel}`,
	}),
	actions: ({ setState }) => {
		const count = (key: "prevent" | "stop" | "once" | "self" | "panel") =>
			setState((state) => {
				state[key] += 1;
			});
		return {
			onPrevent: (event: Event) => {
				count("prevent");
				modifiersLog.info(
					`.prevent ran; defaultPrevented is ${event.defaultPrevented}`,
				);
			},
			onStop: () => count("stop"),
			onOnce: () => {
				count("once");
				modifiersLog.info(".once ran, and won't run again");
			},
			onSelf: () => count("self"),
			onPanel: () => count("panel"),
		};
	},
});

// --------------------------------------------------------
// Key names

const keysLog = createLogger("keys");
const keys = defineStore({
	state: {
		items: ["Inbox", "Drafts", "Sent", "Archive", "Spam"],
		highlighted: 0,
		picked: "nothing yet",
		barOpen: false,
		shiftClicks: 0,
	},
	computed: ({ state }) => ({
		barClosed: () => !state.barOpen,
	}),
	actions: ({ state, setState }) => ({
		itemClass: ({ index }: LoopItem) => ({
			"border-accent text-accent": index === state.highlighted,
		}),
		next: () =>
			setState((draft) => {
				draft.highlighted = (draft.highlighted + 1) % draft.items.length;
			}),
		previous: () =>
			setState((draft) => {
				draft.highlighted =
					(draft.highlighted - 1 + draft.items.length) % draft.items.length;
			}),
		pick: () => {
			const item = state.items[state.highlighted] ?? "";
			setState((draft) => {
				draft.picked = item;
			});
			keysLog.info(`Enter picked ${item}`);
		},
		toggleBar: (event: KeyboardEvent) => {
			setState((draft) => {
				draft.barOpen = !draft.barOpen;
			});
			keysLog.info(`${event.metaKey ? "⌘" : "Ctrl+"}K toggled the command bar`);
		},
		closeBar: () =>
			setState((draft) => {
				draft.barOpen = false;
			}),
		onShiftClick: () =>
			setState((draft) => {
				draft.shiftClicks += 1;
			}),
	}),
});

// --------------------------------------------------------
// Debounce and throttle

const timingLog = createLogger("timing");
const timing = defineStore({
	state: { query: "", searches: 0, raw: 0, throttled: 0 },
	computed: ({ state }) => ({
		searchSummary: () => `searches ${state.searches} · last "${state.query}"`,
		scrollSummary: () => `raw ${state.raw} · throttled ${state.throttled}`,
	}),
	actions: ({ setState }) => ({
		search: (event: Event) => {
			// Debounced actions run after the event, so `currentTarget` is null.
			const query =
				event.target instanceof HTMLInputElement ? event.target.value : "";
			setState((state) => {
				state.query = query;
				state.searches += 1;
			});
			timingLog.info(`Searched for "${query}"`);
		},
		onRawScroll: () =>
			setState((state) => {
				state.raw += 1;
			}),
		onThrottledScroll: () =>
			setState((state) => {
				state.throttled += 1;
			}),
	}),
});

// --------------------------------------------------------
// Outside

const outsideLog = createLogger("outside");
const createDisclosure = (name: string) =>
	defineStore({
		state: { open: false, outside: 0 },
		computed: ({ state }) => ({ closed: () => !state.open }),
		actions: ({ state, setState }) => ({
			open: () =>
				setState((draft) => {
					draft.open = true;
				}),
			toggle: () =>
				setState((draft) => {
					draft.open = !draft.open;
				}),
			close: (event: Event) => {
				if (!state.open) return;
				setState((draft) => {
					draft.open = false;
					draft.outside += 1;
				});
				outsideLog.info(`${event.type} outside closed the ${name}`, {
					target: event.target,
				});
			},
		}),
	});

// --------------------------------------------------------
// Misconfigured

const misconfigured = defineStore({
	state: { count: 0 },
	actions: () => ({
		existing: () => undefined,
	}),
});

startCatalyst({
	stores: {
		elementEvents,
		globalTargets,
		pingA: createPingStore("pingA"),
		pingB: createPingStore("pingB"),
		delegation,
		custom,
		asyncActions,
		defaults,
		modifiers,
		keys,
		timing,
		outsideMenu: createDisclosure("menu"),
		outsidePopup: createDisclosure("popup"),
		misconfigured,
	},
});

// --------------------------------------------------------
// Plain JavaScript controls

const controlsLog = createLogger("controls");

document
	.querySelector("[data-ping-dispatch]")
	?.addEventListener("click", () => {
		document.dispatchEvent(new Event("playground-ping"));
		controlsLog.info("Dispatched playground-ping on document");
	});

for (const button of document.querySelectorAll<HTMLButtonElement>(
	"[data-ping-remove]",
)) {
	button.addEventListener("click", () => {
		const target = document.getElementById(button.dataset.pingRemove ?? "");
		if (!target) return;
		target.remove();
		button.disabled = true;
		controlsLog.info(`Removed #${target.id}`);
	});
}

for (const button of document.querySelectorAll<HTMLButtonElement>(
	"[data-custom-dispatch]",
)) {
	button.addEventListener("click", () => {
		const name = button.dataset.customDispatch ?? "";
		button.dispatchEvent(
			new CustomEvent(name, {
				bubbles: true,
				detail: { id: Number(button.dataset.customId) },
			}),
		);
		controlsLog.info(`Dispatched ${name} from a child button`);
	});
}
