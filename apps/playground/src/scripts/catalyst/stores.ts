import { defineStore, flush } from "@lucidclient/catalyst";
import { initCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

// --------------------------------------------------------
// State, computed values and actions

const counter = defineStore({
	state: { count: 0, step: 1 },
	computed: ({ state }) => ({
		double: () => state.count * 2,
		parity: () => (state.count % 2 === 0 ? "even" : "odd"),
		stepLabel: () => `Step: ${state.step}`,
	}),
	actions: ({ setState }) => ({
		increment: () =>
			setState((state) => {
				state.count += state.step;
			}),
		decrement: () =>
			setState((state) => {
				state.count -= state.step;
			}),
		cycleStep: () =>
			setState((state) => {
				state.step = state.step === 1 ? 5 : state.step === 5 ? 10 : 1;
			}),
		reset: () =>
			setState((state) => {
				state.count = 0;
			}),
	}),
});

// --------------------------------------------------------
// One definition, two scopes

const disclosureLog = createLogger("disclosure");
const disclosure = defineStore({
	state: { open: false, label: "Panel" },
	computed: ({ state }) => ({
		closed: () => !state.open,
		buttonLabel: () => `${state.open ? "Hide" : "Show"} ${state.label}`,
	}),
	actions: ({ setState }) => ({
		toggle: () =>
			setState((state) => {
				state.open = !state.open;
			}),
	}),
	init: ({ state }) => {
		disclosureLog.info(`init ran for the "${state.label}" instance`);
	},
});

// --------------------------------------------------------
// State from a function

let walletCount = 0;
const wallet = defineStore({
	state: () => ({
		id: `wallet-${++walletCount}`,
		createdAt: new Date(),
		formatter: new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency: "GBP",
		}),
		amount: 1250,
	}),
	computed: ({ state }) => ({
		balance: () => state.formatter.format(state.amount),
		created: () => state.createdAt.toLocaleTimeString("en-GB"),
	}),
	actions: ({ setState }) => ({
		deposit: () =>
			setState((state) => {
				state.amount += 99.5;
			}),
	}),
});

// --------------------------------------------------------
// Batched writes and flush

const batchLog = createLogger("batching");
const batching = defineStore({
	state: { value: 0 },
	actions: ({ state, setState }) => ({
		writeAndRead: () => {
			const before = state.value;
			setState((draft) => {
				draft.value += 1;
			});
			const straightAfter = state.value;
			flush();
			const afterFlush = state.value;
			batchLog.info(
				"Read before the write, straight after it, and after flush()",
				{
					before,
					straightAfter,
					afterFlush,
				},
			);
		},
	}),
});

// --------------------------------------------------------
// Direct writes

const directWrite = defineStore({
	state: { value: "unchanged" },
	actions: ({ state, setState }) => ({
		writeDirectly: () => {
			// A type error too: state is read-only.
			(state as { value: string }).value = "written directly";
		},
		writeThroughSetState: () =>
			setState((draft) => {
				draft.value =
					draft.value === "written through setState"
						? "unchanged"
						: "written through setState";
			}),
	}),
});

// --------------------------------------------------------
// Computed values recompute only for the state they read

const memoLog = createLogger("memo");
let recomputes = 0;
const memo = defineStore({
	state: { tracked: 0, untracked: 0 },
	computed: ({ state }) => ({
		trackedLabel: () => {
			recomputes += 1;
			memoLog.info(`trackedLabel recomputed (${recomputes} so far)`);
			return `tracked is ${state.tracked}`;
		},
	}),
	actions: ({ setState }) => ({
		bumpTracked: () =>
			setState((state) => {
				state.tracked += 1;
			}),
		bumpUntracked: () =>
			setState((state) => {
				state.untracked += 1;
			}),
	}),
});

// --------------------------------------------------------
// A definition that throws

const broken = defineStore({
	state: { fromDefinition: "never set" },
	// The return type keeps the definition's actions typed although it throws.
	actions: (): Record<string, () => void> => {
		throw new Error("The actions factory exploded on purpose");
	},
});

initCatalyst({
	stores: {
		counter,
		loginPanel: disclosure,
		signupPanel: disclosure,
		walletA: wallet,
		walletB: wallet,
		batching,
		directWrite,
		memo,
		broken,
	},
});

// --------------------------------------------------------
// A markup-only store, changed from plain JavaScript

const markupOnly = document.querySelector("[data-store='markupOnly']");
document
	.querySelector("[data-markup-only-bump]")
	?.addEventListener("click", () => {
		const current = Number(markupOnly?.getAttribute("data-state--count") ?? 0);
		markupOnly?.setAttribute("data-state--count", String(current + 1));
	});
