import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { clearPersisted, persisted, persistence } from "../src/persistence.js";
import { dom } from "../src/reactions.js";
import type { StorageAdapter } from "../src/types/index.js";
import { catalystWarnings, getStore, setStoreState, settle } from "./utils.js";

const stored = (key: string, storage: Storage = localStorage) => {
	const text = storage.getItem(key);
	return text === null ? null : (JSON.parse(text) as unknown);
};

const save = (key: string, value: unknown, storage: Storage = localStorage) =>
	storage.setItem(key, JSON.stringify(value));

/** Another tab saving a value, which only reaches this tab as an event. */
const saveElsewhere = (key: string, value: unknown) => {
	const newValue = value === undefined ? null : JSON.stringify(value);
	if (newValue === null) localStorage.removeItem(key);
	else localStorage.setItem(key, newValue);
	window.dispatchEvent(
		new StorageEvent("storage", { key, newValue, storageArea: localStorage }),
	);
};

const memoryAdapter = () => {
	const values = new Map<string, unknown>();
	const adapter: StorageAdapter = {
		get: (key) => values.get(key),
		set: (key, value) => values.set(key, value),
		remove: (key) => values.delete(key),
	};
	return { adapter, values };
};

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

afterEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

describe("persisted state", () => {
	it("restores a stored value before init, effects and the first bindings", async () => {
		save("catalyst:prefs:theme", "dark");
		document.body.innerHTML = `
			<div data-store="prefs"><span data-dom--text="$theme"></span></div>
		`;

		const seen: string[] = [];
		const prefs = defineStore({
			state: { theme: persisted("light"), busy: false },
			effects: ({ state, effect }) => ({
				log: effect(
					() => state.theme,
					(theme) => {
						seen.push(`effect:${theme}`);
					},
				),
			}),
			init: ({ state }) => {
				seen.push(`init:${state.theme}`);
			},
		});

		Catalyst.init({
			persistence: persistence(),
			stores: { prefs },
			reactions: [dom],
		});
		expect(document.querySelector("span")?.textContent).toBe("dark");
		expect(seen).toEqual(["init:dark", "effect:dark"]);
		await settle();
		expect(getStore("prefs")?.state.theme).toBe("dark");
	});

	it("saves changes, but not values that were never changed", async () => {
		document.body.innerHTML = `<div data-store="prefs"></div>`;
		const prefs = defineStore({
			state: { theme: persisted("light"), busy: false },
		});

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		await settle();
		expect(localStorage.length).toBe(0);

		setStoreState("prefs", "theme", "dark");
		setStoreState("prefs", "busy", true);
		await settle();
		expect(stored("catalyst:prefs:theme")).toBe("dark");
		expect(localStorage.length).toBe(1);
	});

	it("saves a value that init changes", async () => {
		document.body.innerHTML = `<div data-store="visits"></div>`;
		const visits = defineStore({
			state: { count: persisted(0) },
			init: ({ setState }) => {
				setState((state) => {
					state.count += 1;
				});
			},
		});

		Catalyst.init({ persistence: persistence(), stores: { visits } });
		await settle();
		expect(stored("catalyst:visits:count")).toBe(1);
	});

	it("saves nested changes", async () => {
		document.body.innerHTML = `<div data-store="list"></div>`;
		const list = defineStore({
			state: { items: persisted([] as string[]) },
			actions: ({ setState }) => ({
				add: (item: string) =>
					setState((state) => {
						state.items.push(item);
					}),
			}),
		});

		Catalyst.init({ persistence: persistence(), stores: { list } });
		getStore("list")?.actions.add?.("one");
		await settle();
		getStore("list")?.actions.add?.("two");
		await settle();
		expect(stored("catalyst:list:items")).toEqual(["one", "two"]);
	});

	it("uses a stored value over the state attribute, and writes it to the attribute", async () => {
		save("catalyst:prefs:theme", "dark");
		document.body.innerHTML = `
			<div data-store="prefs" data-state--theme="light"></div>
		`;
		const prefs = defineStore({ state: { theme: persisted("light") } });

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		await settle();
		expect(getStore("prefs")?.state.theme).toBe("dark");
		expect(
			document.querySelector("[data-store]")?.getAttribute("data-state--theme"),
		).toBe("dark");
	});

	it("persists markup-only state with data-persist", async () => {
		save("catalyst:markup:sidebarOpen", false);
		save("catalyst:markup:draft", "Hello", sessionStorage);
		document.body.innerHTML = `
			<div
				data-store="markup"
				data-state--sidebar-open="true"
				data-state--draft=""
				data-state--count="1"
				data-persist="sidebarOpen, count"
				data-persist--session="draft"
			></div>
		`;

		Catalyst.init({ persistence: persistence() });
		await settle();
		const store = getStore("markup");
		expect(store?.state.sidebarOpen).toBe(false);
		expect(store?.state.draft).toBe("Hello");

		setStoreState("markup", "count", 2);
		setStoreState("markup", "draft", "Hello world");
		await settle();
		expect(stored("catalyst:markup:count")).toBe(2);
		expect(stored("catalyst:markup:draft", sessionStorage)).toBe("Hello world");
		expect(localStorage.getItem("catalyst:markup:draft")).toBeNull();
	});

	it("lets markup persist more keys and choose their storage for one store", async () => {
		document.body.innerHTML = `
			<div data-store="loginDialog" data-persist--session="open"></div>
			<div data-store="signupDialog"></div>
		`;
		const dialog = defineStore({
			state: { open: false, tab: persisted("email") },
		});

		Catalyst.init({
			persistence: persistence(),
			stores: { loginDialog: dialog, signupDialog: dialog },
		});
		for (const scope of ["loginDialog", "signupDialog"]) {
			setStoreState(scope, "open", true);
			setStoreState(scope, "tab", "phone");
		}
		await settle();

		expect(stored("catalyst:loginDialog:open", sessionStorage)).toBe(true);
		expect(stored("catalyst:loginDialog:tab")).toBe("phone");
		expect(localStorage.getItem("catalyst:signupDialog:open")).toBeNull();
		expect(stored("catalyst:signupDialog:tab")).toBe("phone");
	});

	it("lets markup choose the storage of a value the definition persists", async () => {
		document.body.innerHTML = `
			<div data-store="prefs" data-persist--session="theme"></div>
		`;
		const prefs = defineStore({
			state: { theme: persisted("light", { storage: "local" }) },
		});

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		setStoreState("prefs", "theme", "dark");
		await settle();
		expect(stored("catalyst:prefs:theme", sessionStorage)).toBe("dark");
		expect(localStorage.getItem("catalyst:prefs:theme")).toBeNull();
	});

	it("ignores stored values of the wrong type, invalid values and broken JSON", async () => {
		save("catalyst:prefs:open", "yes");
		save("catalyst:prefs:theme", "purple");
		save("catalyst:prefs:links", { not: "an array" });
		localStorage.setItem("catalyst:prefs:size", "{broken");
		save("catalyst:prefs:user", { name: "Ada" });
		document.body.innerHTML = `<div data-store="prefs"></div>`;

		type Theme = "light" | "dark";
		const prefs = defineStore({
			state: {
				open: persisted(false),
				theme: persisted("light" as Theme, {
					validate: (value) => value === "light" || value === "dark",
				}),
				links: persisted([] as string[]),
				size: persisted(1),
				user: persisted(null as { name: string } | null),
			},
		});

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		await settle();
		const state = getStore("prefs")?.state;
		expect(state?.open).toBe(false);
		expect(state?.theme).toBe("light");
		expect(state?.links).toEqual([]);
		expect(state?.size).toBe(1);
		expect(state?.user).toEqual({ name: "Ada" });
	});

	it("restores state from a function and keeps each store's starting value separate", async () => {
		save("catalyst:a:items", ["saved"]);
		document.body.innerHTML = `
			<div data-store="a"></div>
			<div data-store="b"></div>
		`;
		const list = defineStore({
			state: () => ({ items: persisted([] as string[]) }),
		});

		Catalyst.init({
			persistence: persistence(),
			stores: { a: list, b: list },
		});
		await settle();
		expect(getStore("a")?.state.items).toEqual(["saved"]);
		expect(getStore("b")?.state.items).toEqual([]);
	});

	it("uses the key option and the configured prefix", async () => {
		document.body.innerHTML = `<div data-store="header"></div>`;
		const header = defineStore({
			state: { theme: persisted("light", { key: "theme" }) },
		});

		Catalyst.init({
			stores: { header },
			persistence: persistence({ prefix: "site:" }),
		});
		setStoreState("header", "theme", "dark");
		await settle();
		expect(stored("site:theme")).toBe("dark");
	});

	it("saves to a registered adapter, and uses the configured default storage", async () => {
		const { adapter, values } = memoryAdapter();
		values.set("catalyst:prefs:theme", "dark");
		document.body.innerHTML = `
			<div
				data-store="prefs"
				data-state--count="0"
				data-persist--memory="count"
			></div>
		`;
		const prefs = defineStore({ state: { theme: persisted("light") } });

		Catalyst.init({
			stores: { prefs },
			persistence: persistence({
				storage: "memory",
				adapters: { memory: adapter },
			}),
		});
		expect(getStore("prefs")?.state.theme).toBe("dark");

		setStoreState("prefs", "count", 3);
		await settle();
		expect(values.get("catalyst:prefs:count")).toBe(3);
		expect(localStorage.length).toBe(0);
	});

	it("removes the stored value when the state becomes undefined", async () => {
		save("catalyst:prefs:note", "saved");
		document.body.innerHTML = `<div data-store="prefs"></div>`;
		const prefs = defineStore({
			state: { note: persisted("" as string | undefined) },
		});

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		setStoreState("prefs", "note", undefined);
		await settle();
		expect(localStorage.getItem("catalyst:prefs:note")).toBeNull();
	});

	it("warns about keys, values and storage it can't persist", async () => {
		document.body.innerHTML = `
			<div
				data-store="prefs"
				data-state--sidebar-open="true"
				data-persist="sidebar-open missing label"
				data-persist--mycookie="sidebarOpen"
			></div>
		`;
		const prefs = defineStore({
			state: { open: false, lookup: persisted(new Map<string, string>()) },
			computed: ({ state }) => ({ label: () => String(state.open) }),
		});

		Catalyst.init({
			stores: { prefs },
			persistence: persistence({
				adapters: { myCookie: memoryAdapter().adapter },
			}),
		});
		await settle();
		expect(catalystWarnings()).toEqual([
			'[Catalyst] Cannot persist "lookup" on store "prefs" because its value can\'t be saved as JSON.',
			'[Catalyst] The "data-persist" value "sidebar-open" on store "prefs" does not match the "sidebarOpen" state. Use "sidebarOpen" instead.',
			'[Catalyst] Cannot persist "missing" on store "prefs" because it isn\'t a state value.',
			'[Catalyst] Cannot persist "label" on store "prefs" because it isn\'t a state value.',
			'[Catalyst] The "mycookie" storage for "sidebarOpen" on store "prefs" isn\'t registered. HTML lowercases attribute names, so register the "myCookie" adapter under a lowercase name.',
		]);
	});

	it("keeps working and warns once when storage fails", async () => {
		const failing: StorageAdapter = {
			get: () => {
				throw new Error("blocked");
			},
			set: () => {
				throw new Error("full");
			},
			remove: () => {},
		};
		document.body.innerHTML = `
			<div data-store="prefs"><span data-dom--text="$theme"></span></div>
		`;
		const prefs = defineStore({ state: { theme: persisted("light") } });

		Catalyst.init({
			stores: { prefs },
			reactions: [dom],
			persistence: persistence({ adapters: { local: failing } }),
		});
		setStoreState("prefs", "theme", "dark");
		await settle();
		setStoreState("prefs", "theme", "blue");
		await settle();

		expect(document.querySelector("span")?.textContent).toBe("blue");
		expect(catalystWarnings()).toEqual([
			'[Catalyst] Could not restore "theme" on store "prefs" from local storage, so it starts from its default.',
		]);
	});

	it("re-reads storage when a store is refreshed", async () => {
		document.body.innerHTML = `<div data-store="prefs"></div>`;
		const prefs = defineStore({ state: { theme: persisted("light") } });

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		setStoreState("prefs", "theme", "dark");
		await settle();

		Catalyst.refresh("prefs");
		expect(getStore("prefs")?.state.theme).toBe("dark");
	});

	it("stops saving once the store is destroyed", async () => {
		document.body.innerHTML = `<div data-store="prefs"></div>`;
		const prefs = defineStore({ state: { theme: persisted("light") } });

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		const store = getStore("prefs");
		Catalyst.destroy();
		store?.setState((state) => {
			state.theme = "dark";
		});
		await settle();
		expect(localStorage.length).toBe(0);
	});
});

describe("without persistence", () => {
	it("keeps persisted values as plain state and warns that they aren't saved", async () => {
		document.body.innerHTML = `
			<div data-store="prefs"></div>
			<div data-store="menu" data-state--open="false" data-persist="open"></div>
		`;
		const prefs = defineStore({ state: { theme: persisted("light") } });

		Catalyst.init({ stores: { prefs } });
		expect(getStore("prefs")?.state.theme).toBe("light");
		setStoreState("prefs", "theme", "dark");
		setStoreState("menu", "open", true);
		await settle();

		expect(getStore("prefs")?.state.theme).toBe("dark");
		expect(localStorage.length).toBe(0);
		expect(catalystWarnings()).toEqual([
			'[Catalyst] Store "prefs" persists state, but persistence isn\'t enabled, so it won\'t be saved. Pass persistence() from "@lucidclient/catalyst/persistence" to Catalyst.init.',
			'[Catalyst] Store "menu" persists state, but persistence isn\'t enabled, so it won\'t be saved. Pass persistence() from "@lucidclient/catalyst/persistence" to Catalyst.init.',
		]);
	});
});

describe("persisted state across tabs", () => {
	it("ignores other tabs by default", async () => {
		document.body.innerHTML = `<div data-store="prefs"></div>`;
		const prefs = defineStore({ state: { theme: persisted("light") } });

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		saveElsewhere("catalyst:prefs:theme", "dark");
		await settle();
		expect(getStore("prefs")?.state.theme).toBe("light");
	});

	it("applies changes from other tabs when sync is on", async () => {
		document.body.innerHTML = `
			<div data-store="prefs"><span data-dom--text="$theme"></span></div>
		`;
		const prefs = defineStore({
			state: {
				theme: persisted("light", { sync: true }),
				open: persisted(false),
			},
		});

		Catalyst.init({
			persistence: persistence(),
			stores: { prefs },
			reactions: [dom],
		});
		saveElsewhere("catalyst:prefs:theme", "dark");
		saveElsewhere("catalyst:prefs:open", true);
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("dark");
		expect(getStore("prefs")?.state.open).toBe(false);

		// Removed elsewhere, so the starting value is used again.
		saveElsewhere("catalyst:prefs:theme", undefined);
		await settle();
		expect(getStore("prefs")?.state.theme).toBe("light");
		expect(localStorage.getItem("catalyst:prefs:theme")).toBeNull();
	});

	it("uses the global sync option for markup-only state and ignores invalid values", async () => {
		document.body.innerHTML = `
			<div data-store="prefs" data-state--count="1" data-persist="count"></div>
		`;

		Catalyst.init({ persistence: persistence({ sync: true }) });
		saveElsewhere("catalyst:prefs:count", "not a number");
		await settle();
		expect(getStore("prefs")?.state.count).toBe(1);

		saveElsewhere("catalyst:prefs:count", 5);
		await settle();
		expect(getStore("prefs")?.state.count).toBe(5);
	});

	it("stops listening when the store is destroyed", async () => {
		document.body.innerHTML = `<div data-store="prefs"></div>`;
		const prefs = defineStore({
			state: { theme: persisted("light", { sync: true }) },
		});

		Catalyst.init({ persistence: persistence(), stores: { prefs } });
		const store = getStore("prefs");
		Catalyst.destroy();
		saveElsewhere("catalyst:prefs:theme", "dark");
		await settle();
		expect(store?.state.theme).toBe("light");
	});
});

describe("clearPersisted", () => {
	it("removes a store's saved values, or every store's", async () => {
		document.body.innerHTML = `
			<div data-store="a"></div>
			<div data-store="b"></div>
		`;
		const prefs = defineStore({ state: { theme: persisted("light") } });

		Catalyst.init({
			persistence: persistence(),
			stores: { a: prefs, b: prefs },
		});
		setStoreState("a", "theme", "dark");
		setStoreState("b", "theme", "dark");
		await settle();

		clearPersisted("a");
		expect(localStorage.getItem("catalyst:a:theme")).toBeNull();
		expect(stored("catalyst:b:theme")).toBe("dark");
		expect(getStore("a")?.state.theme).toBe("dark");

		clearPersisted();
		expect(localStorage.length).toBe(0);

		setStoreState("a", "theme", "light");
		await settle();
		expect(stored("catalyst:a:theme")).toBe("light");
	});

	it("warns for an unknown store", () => {
		document.body.innerHTML = "";
		Catalyst.init({ persistence: persistence() });
		clearPersisted("missing");
		expect(catalystWarnings()).toEqual([
			'[Catalyst] Cannot clear persisted state for unknown store "missing".',
		]);
	});
});
