import Catalyst, { defineStore } from "@lucidclient/catalyst";
import {
	clearPersisted,
	persisted,
	persistence,
} from "@lucidclient/catalyst/persistence";
import { startCatalyst } from "../../lib/catalyst";
import { createLogger } from "../../lib/log";

// --------------------------------------------------------
// Persisted preferences

type Theme = "light" | "dark";

const prefs = defineStore({
	state: {
		theme: persisted("light" as Theme, {
			validate: (value) => value === "light" || value === "dark",
		}),
		sidebarOpen: persisted(true),
		fontSize: persisted(16),
		busy: false,
	},
	computed: ({ state }) => ({
		summary: () =>
			`${state.theme} theme, sidebar ${state.sidebarOpen ? "open" : "closed"}, ${state.fontSize}px text`,
		fontSizeLabel: () => `${state.fontSize}px`,
	}),
	actions: ({ setState }) => ({
		toggleBusy: () =>
			setState((draft) => {
				draft.busy = !draft.busy;
			}),
	}),
});

// --------------------------------------------------------
// One definition, persisted in one scope

const disclosure = defineStore({
	state: { open: false },
	computed: ({ state }) => ({
		closed: () => !state.open,
		label: () => (state.open ? "Hide" : "Show"),
	}),
	actions: ({ setState }) => ({
		toggle: () =>
			setState((draft) => {
				draft.open = !draft.open;
			}),
	}),
});

// --------------------------------------------------------
// Stale and invalid stored values

const legacy = defineStore({
	state: {
		theme: persisted("light" as Theme, {
			validate: (value) => value === "light" || value === "dark",
		}),
		count: persisted(0),
	},
	actions: ({ setState }) => ({
		increment: () =>
			setState((draft) => {
				draft.count += 1;
			}),
		toggleTheme: () =>
			setState((draft) => {
				draft.theme = draft.theme === "light" ? "dark" : "light";
			}),
	}),
});

// --------------------------------------------------------
// Following other tabs

const tabs = defineStore({
	state: {
		synced: persisted(0, { sync: true }),
		unsynced: persisted(0),
	},
	actions: ({ setState }) => ({
		incrementSynced: () =>
			setState((draft) => {
				draft.synced += 1;
			}),
		incrementUnsynced: () =>
			setState((draft) => {
				draft.unsynced += 1;
			}),
	}),
});

startCatalyst({
	persistence: persistence(),
	stores: {
		prefs,
		helpPanel: disclosure,
		tipsPanel: disclosure,
		legacy,
		tabs,
	},
});

// --------------------------------------------------------
// Storage readouts

const PREFIX = "catalyst:";

const readStorage = (storage: Storage, label: string) => {
	const lines: string[] = [];
	for (let index = 0; index < storage.length; index++) {
		const key = storage.key(index);
		if (!key?.startsWith(PREFIX)) continue;
		lines.push(`${label}  ${key} = ${storage.getItem(key)}`);
	}
	return lines.sort();
};

const renderReadouts = () => {
	const lines = [
		...readStorage(localStorage, "local  "),
		...readStorage(sessionStorage, "session"),
	];
	for (const output of document.querySelectorAll<HTMLElement>(
		"[data-storage-readout]",
	)) {
		const filter = output.dataset.storageReadout ?? "";
		const shown = filter
			? lines.filter((line) => line.includes(`${PREFIX}${filter}`))
			: lines;
		const text = shown.length ? shown.join("\n") : "Nothing saved yet";
		if (output.textContent !== text) output.textContent = text;
	}
};

// Writes in this tab fire no event, so the readouts poll.
renderReadouts();
setInterval(renderReadouts, 250);

// --------------------------------------------------------
// Plain JavaScript controls

const controlsLog = createLogger("storage controls");

const writeAndRefresh = (key: string, text: string) => {
	localStorage.setItem(key, text);
	controlsLog.info(`Saved ${key} = ${text}, then refreshed the store`);
	Catalyst.refresh("legacy");
};

const legacyControls: Record<string, () => void> = {
	"invalid-theme": () =>
		writeAndRefresh("catalyst:legacy:theme", JSON.stringify("purple")),
	"wrong-type": () =>
		writeAndRefresh("catalyst:legacy:count", JSON.stringify("twelve")),
	"broken-json": () => writeAndRefresh("catalyst:legacy:count", "{broken"),
	valid: () => writeAndRefresh("catalyst:legacy:count", JSON.stringify(42)),
	refresh: () => {
		Catalyst.refresh("legacy");
		controlsLog.info("Refreshed the legacy store");
	},
};

for (const button of document.querySelectorAll<HTMLButtonElement>(
	"[data-legacy-control]",
)) {
	button.addEventListener("click", () =>
		legacyControls[button.dataset.legacyControl ?? ""]?.(),
	);
}

document.querySelector("[data-clear-prefs]")?.addEventListener("click", () => {
	clearPersisted("prefs");
	controlsLog.info('Ran clearPersisted("prefs")');
});

document.querySelector("[data-clear-all]")?.addEventListener("click", () => {
	clearPersisted();
	controlsLog.info("Ran clearPersisted()");
});

document.querySelector("[data-reload]")?.addEventListener("click", () => {
	location.reload();
});
