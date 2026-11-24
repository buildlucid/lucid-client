import Catalyst, { defineStore } from "@lucidclient/catalyst";
import type { Reaction } from "@lucidclient/catalyst/types";
import { allReactions, initCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

// --------------------------------------------------------
// The probe reaction counts live directives, so disposal is visible

const probeCounts = new Map<string, number>();

const renderProbes = () => {
	let total = 0;
	for (const count of probeCounts.values()) total += count;
	for (const element of document.querySelectorAll<HTMLElement>(
		"[data-probe-count]",
	)) {
		const group = element.dataset.probeCount ?? "";
		element.textContent = String(
			group === "*" ? total : (probeCounts.get(group) ?? 0),
		);
	}
};

const probe: Reaction = {
	name: "probe",
	attribute: "probe",
	setup: ({ value }) => {
		probeCounts.set(value, (probeCounts.get(value) ?? 0) + 1);
		renderProbes();
		return () => {
			probeCounts.set(value, (probeCounts.get(value) ?? 1) - 1);
			renderProbes();
		};
	},
};

// --------------------------------------------------------
// sync on injected markup

const injectLog = createLogger("injector");

const injectedMarkup = (count: number) => `
<div data-store="injected" data-state--clicks="0" data-probe="inject" class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-raised px-3 py-2">
	<button class="btn btn-sm" data-events--click="@bump" data-probe="inject">Injected button #${count}</button>
	<span class="text-sm text-muted">clicks <span class="font-mono text-fg" data-dom--text="$clicks" data-probe="inject"></span></span>
	<span class="text-sm text-muted">injector:$open <span class="font-mono text-fg" data-dom--text="injector:$open" data-probe="inject"></span></span>
</div>`;

const injector = defineStore({
	state: { open: false, injections: 0 },
	actions: ({ state, setState, refs }) => {
		const write = () => {
			const slot = refs.get("slot");
			if (!slot) return undefined;
			setState((draft) => {
				draft.injections += 1;
			});
			slot.innerHTML = injectedMarkup(state.injections + 1);
			return slot;
		};
		return {
			injectAndSync: () => {
				const slot = write();
				if (!slot) return;
				Catalyst.sync(slot);
				injectLog.info("Replaced the markup and called Catalyst.sync(slot)");
			},
			injectAndSyncNextTask: () => {
				const slot = write();
				if (!slot) return;
				injectLog.info(
					"Replaced the markup; calling Catalyst.sync(slot) on the next task",
				);
				setTimeout(() => Catalyst.sync(slot), 0);
			},
			injectOnly: () => {
				write();
				injectLog.info("Replaced the markup without syncing");
			},
			syncSlot: () => {
				const slot = refs.get("slot");
				if (!slot) return;
				Catalyst.sync(slot);
				injectLog.info("Called Catalyst.sync(slot)");
			},
			toggleOpen: () =>
				setState((draft) => {
					draft.open = !draft.open;
				}),
		};
	},
});

const injectedLog = createLogger("injected");
const injected = defineStore({
	state: { clicks: 0 },
	actions: ({ setState }) => ({
		bump: () =>
			setState((state) => {
				state.clicks += 1;
			}),
	}),
	init: () => {
		injectedLog.success("init ran");
		return () => injectedLog.info("cleanup ran");
	},
});

// --------------------------------------------------------
// Removing markup disposes it

const removalLog = createLogger("removal");
let detached: Element | null = null;

const removal = defineStore({
	state: { phase: "attached" as "attached" | "removed" | "reinserted" },
	computed: ({ state }) => ({
		status: () =>
			({
				attached: "Attached and synced",
				removed: "Removed from the page",
				reinserted: "Re-inserted, not synced yet",
			})[state.phase],
		isAttached: () => state.phase !== "removed",
		isRemoved: () => state.phase === "removed",
		isSynced: () => state.phase === "attached",
	}),
	actions: ({ setState, refs }) => ({
		remove: () => {
			const host = refs.get("host");
			detached = host?.firstElementChild ?? null;
			if (!detached) return;
			detached.remove();
			removalLog.info("Removed the ticker subtree");
			setState((state) => {
				state.phase = "removed";
			});
		},
		reinsert: () => {
			const host = refs.get("host");
			if (!host || !detached) return;
			host.append(detached);
			detached = null;
			removalLog.info("Re-inserted the same element, without syncing");
			setState((state) => {
				state.phase = "reinserted";
			});
		},
		syncHost: () => {
			const host = refs.get("host");
			if (!host) return;
			Catalyst.sync(host);
			removalLog.info("Called Catalyst.sync(host)");
			setState((state) => {
				state.phase = "attached";
			});
		},
	}),
});

const tickerLog = createLogger("ticker");
const ticker = defineStore({
	state: { seconds: 0, keys: 0 },
	actions: ({ setState }) => ({
		onKey: (event: KeyboardEvent) => {
			tickerLog.info(`document keydown handled (${event.key})`);
			setState((state) => {
				state.keys += 1;
			});
		},
	}),
	init: ({ setState }) => {
		tickerLog.success("init ran, interval started");
		const interval = setInterval(() => {
			setState((state) => {
				state.seconds += 1;
			});
		}, 1000);
		return () => {
			clearInterval(interval);
			tickerLog.info("cleanup ran, interval cleared");
		};
	},
});

// --------------------------------------------------------
// State attributes added later

const lateLog = createLogger("lateState");
const lateState = defineStore({
	actions: ({ state, refs }) => ({
		stateJson: () => JSON.stringify(state),
		addAttribute: () => {
			refs.get("root")?.setAttribute("data-state--added-later", "true");
			lateLog.info('Set data-state--added-later="true" without syncing');
		},
		changeAttribute: () => {
			const root = refs.get("root");
			const current = Number(root?.getAttribute("data-state--count") ?? 0);
			root?.setAttribute("data-state--count", String(current + 1));
			lateLog.info("Changed data-state--count on the element");
		},
		syncRoot: () => {
			const root = refs.get("root");
			if (!root) return;
			Catalyst.sync(root);
			lateLog.info("Called Catalyst.sync(root)");
		},
	}),
});

// --------------------------------------------------------
// Changing an element's data-store value

const swapLog = createLogger("swap");
const swapTo = (event: Event, next: string) => {
	const root =
		event.currentTarget instanceof Element
			? event.currentTarget.closest("[data-store]")
			: null;
	if (!root) return;
	root.setAttribute("data-store", next);
	Catalyst.sync(root);
	swapLog.info(`Set data-store="${next}" and synced`);
};

const swapA = defineStore({
	state: { label: "Store A", createdAt: "" },
	actions: () => ({
		swap: (event: Event) => swapTo(event, "swapB"),
	}),
	init: ({ setState }) => {
		setState((state) => {
			state.createdAt = new Date().toLocaleTimeString("en-GB");
		});
		swapLog.success("swapA init ran");
		return () => swapLog.info("swapA cleanup ran");
	},
});

const swapB = defineStore({
	state: { label: "Store B", createdAt: "" },
	actions: () => ({
		swap: (event: Event) => swapTo(event, "swapA"),
	}),
	init: ({ setState }) => {
		setState((state) => {
			state.createdAt = new Date().toLocaleTimeString("en-GB");
		});
		swapLog.success("swapB init ran");
		return () => swapLog.info("swapB cleanup ran");
	},
});

// --------------------------------------------------------
// refresh() and refresh(scope)

const refreshLog = createLogger("refresh");
const refreshCounter = (name: string) =>
	defineStore({
		state: { count: 0 },
		actions: ({ setState }) => ({
			increment: () =>
				setState((state) => {
					state.count += 1;
				}),
		}),
		init: ({ state }) => {
			refreshLog.success(`${name} init ran with count ${state.count}`);
			return () => refreshLog.info(`${name} cleanup ran`);
		},
	});

const refreshControls = defineStore({
	actions: () => ({
		refreshA: () => {
			refreshLog.info('Catalyst.refresh("refreshA")');
			Catalyst.refresh("refreshA");
		},
		refreshAll: () => {
			refreshLog.info("Catalyst.refresh()");
			Catalyst.refresh();
		},
		refreshUnknown: () => {
			Catalyst.refresh("doesNotExist");
		},
	}),
});

// --------------------------------------------------------
// destroy() and init()

const lifecycleLog = createLogger("lifecycle");
const lifecycleCounter = defineStore({
	state: { count: 0 },
	actions: ({ setState }) => ({
		increment: () =>
			setState((state) => {
				state.count += 1;
			}),
	}),
	init: () => {
		lifecycleLog.success("lifecycleCounter init ran");
		return () => lifecycleLog.info("lifecycleCounter cleanup ran");
	},
});

// --------------------------------------------------------
// Catalyst.add with a store loaded on demand

const loaderLog = createLogger("loader");
const lazyLoader = defineStore({
	state: { loaded: false, loading: false },
	computed: ({ state }) => ({
		buttonLabel: () =>
			state.loaded
				? "Store module loaded"
				: state.loading
					? "Loading…"
					: "Load the store module",
	}),
	actions: ({ state, setState }) => ({
		load: async () => {
			if (state.loaded || state.loading) return;
			setState((draft) => {
				draft.loading = true;
			});
			await new Promise((resolve) => setTimeout(resolve, 400));
			const { lazyCart } = await import("./lazy-cart");
			Catalyst.add({ stores: { lazyCart } });
			loaderLog.success(
				"Imported lazy-cart.ts and called Catalyst.add({ stores: { lazyCart } })",
			);
			setState((draft) => {
				draft.loading = false;
				draft.loaded = true;
			});
		},
	}),
});

// --------------------------------------------------------

// --------------------------------------------------------
// data-ignore

const ignoreLog = createLogger("ignore");
const ignoreHost = defineStore({
	state: { name: "Ada" },
	actions: ({ state }) => ({
		bound: () => `Bound: ${state.name}`,
		press: () => ignoreLog.info("Press ran"),
	}),
});

initCatalyst({
	stores: {
		ignoreHost,
		injector,
		injected,
		removal,
		ticker,
		lateState,
		swapA,
		swapB,
		refreshA: refreshCounter("refreshA"),
		refreshB: refreshCounter("refreshB"),
		refreshControls,
		lifecycleCounter,
		lazyLoader,
	},
	reactions: [...allReactions, probe],
});
renderProbes();

// Plain JavaScript controls, which keep working while Catalyst is destroyed.
const status = document.querySelector<HTMLElement>("[data-lifecycle-status]");
const renderStatus = (running: boolean) => {
	if (!status) return;
	status.textContent = running ? "running" : "destroyed";
	status.dataset.running = String(running);
};
renderStatus(true);

for (const button of document.querySelectorAll<HTMLButtonElement>(
	"[data-lifecycle]",
)) {
	button.addEventListener("click", () => {
		switch (button.dataset.lifecycle) {
			case "destroy":
				lifecycleLog.info("Catalyst.destroy()");
				Catalyst.destroy();
				renderStatus(false);
				break;
			case "init":
				lifecycleLog.info(
					"Catalyst.init({ debug: true }), with no stores or reactions",
				);
				Catalyst.init({ debug: true });
				renderStatus(true);
				break;
			case "init-again":
				lifecycleLog.info("Catalyst.init() while it is already running");
				Catalyst.init({ debug: true });
				break;
		}
	});
}

document
	.querySelector("[data-dispatch-keydown]")
	?.addEventListener("click", () => {
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
	});

document
	.querySelector("[data-ignore-inject]")
	?.addEventListener("click", () => {
		for (const target of document.querySelectorAll<HTMLElement>(
			"[data-ignore-target]",
		)) {
			target.innerHTML = `<p data-dom--text="ignoreHost:@bound">Injected, not bound</p>`;
			Catalyst.sync(target);
		}
		ignoreLog.info("Injected the same markup into both panels and synced each");
	});
