import { defineStore } from "@lucidclient/catalyst";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

const log = createLogger("traps");

// --------------------------------------------------------
// Helpers

const describeFocus = () => {
	const element = document.activeElement;
	if (!element || element === document.body) return "<body>";
	const label =
		element.getAttribute("aria-label") ??
		(element instanceof HTMLInputElement
			? element.placeholder
			: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 32));
	return `<${element.localName}>${label ? ` ${label}` : ""}`;
};

/** What the trap changed: where focus is, page scrolling and inert elements. */
const trapStatus = () => ({
	focus: describeFocus(),
	bodyOverflow: document.body.style.overflow || "(not set)",
	inertElements: document.querySelectorAll("[inert]").length,
});

/** Logs the trap status once the trap and its focus changes have applied. */
const logAfterChange = (label: string) => {
	const timer = setTimeout(() => log.info(label, trapStatus()), 60);
	return () => clearTimeout(timer);
};

const isEscape = (event: Event) =>
	event instanceof KeyboardEvent && event.key === "Escape";

// Live status lines inside the dialogs.
setInterval(() => {
	const status = trapStatus();
	for (const element of document.querySelectorAll("pg-trap-status")) {
		element.textContent = `focus ${status.focus} · body overflow ${status.bodyOverflow} · ${status.inertElements} inert`;
	}
}, 200);

// --------------------------------------------------------
// A modal, registered under several scopes

const modal = defineStore({
	state: { open: false, name: "modal" },
	computed: ({ state }) => ({
		closed: () => !state.open,
	}),
	actions: ({ state, setState }) => ({
		open: () =>
			setState((draft) => {
				draft.open = true;
			}),
		close: () =>
			setState((draft) => {
				draft.open = false;
			}),
		closeOnEscape: (event: Event) => {
			if (!state.open || !isEscape(event)) return;
			setState((draft) => {
				draft.open = false;
			});
		},
		closeOnBackdrop: (event: Event) => {
			if (event.target !== event.currentTarget) return;
			setState((draft) => {
				draft.open = false;
			});
		},
	}),
	effects: ({ state, effect }) => ({
		report: effect(
			() => state.open,
			(open, { isInitial }) => {
				if (isInitial) return;
				return logAfterChange(`${state.name} ${open ? "opened" : "closed"}`);
			},
		),
	}),
});

// --------------------------------------------------------
// Stacked traps

const stacked = defineStore({
	state: { outer: false, inner: false },
	computed: ({ state }) => ({
		outerClosed: () => !state.outer,
		innerClosed: () => !state.inner,
	}),
	actions: ({ state, setState }) => ({
		openOuter: () =>
			setState((draft) => {
				draft.outer = true;
			}),
		closeOuter: () =>
			setState((draft) => {
				draft.inner = false;
				draft.outer = false;
			}),
		openInner: () =>
			setState((draft) => {
				draft.inner = true;
			}),
		closeInner: () =>
			setState((draft) => {
				draft.inner = false;
			}),
		// One listener closes the innermost open dialog.
		closeOnEscape: (event: Event) => {
			if (!isEscape(event)) return;
			setState((draft) => {
				if (state.inner) draft.inner = false;
				else if (state.outer) draft.outer = false;
			});
		},
	}),
	effects: ({ state, effect }) => ({
		reportOuter: effect(
			() => state.outer,
			(open, { isInitial }) =>
				isInitial
					? undefined
					: logAfterChange(`outer dialog ${open ? "opened" : "closed"}`),
		),
		reportInner: effect(
			() => state.inner,
			(open, { isInitial }) =>
				isInitial
					? undefined
					: logAfterChange(`inner dialog ${open ? "opened" : "closed"}`),
		),
	}),
});

// --------------------------------------------------------
// A drawer with data-trap--both and data-trap-allow

const drawer = defineStore({
	state: { open: false },
	computed: ({ state }) => ({
		buttonLabel: () => (state.open ? "Close menu" : "Open menu"),
	}),
	actions: ({ state, setState }) => ({
		toggle: () =>
			setState((draft) => {
				draft.open = !draft.open;
			}),
		closeOnEscape: (event: Event) => {
			if (!state.open || !isEscape(event)) return;
			setState((draft) => {
				draft.open = false;
			});
		},
	}),
	effects: ({ state, effect }) => ({
		report: effect(
			() => state.open,
			(open, { isInitial }) =>
				isInitial
					? undefined
					: logAfterChange(`drawer ${open ? "opened" : "closed"}`),
		),
	}),
});

startCatalyst({
	stores: {
		basicModal: modal,
		autofocusModal: modal,
		emptyModal: modal,
		inertModal: modal,
		hiddenModal: modal,
		stacked,
		drawer,
	},
});
