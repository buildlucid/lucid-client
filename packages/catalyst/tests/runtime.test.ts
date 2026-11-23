import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { dom, events, loop } from "../src/reactions.js";
import Runtime from "../src/runtime/catalyst.js";
import {
	allowConsoleErrors,
	catalystWarnings,
	getStore,
	setStoreState,
	settle,
} from "./utils.js";

describe("runtime robustness", () => {
	it("isolates a store whose definition throws", () => {
		allowConsoleErrors();
		document.body.innerHTML = `
			<div data-store="broken" data-state--label="html state">
				<span id="broken" data-dom--text="$label"></span>
			</div>
			<div data-store="healthy" data-state--label="ok">
				<span id="healthy" data-dom--text="$label"></span>
			</div>
		`;
		const fail = (message: string) => {
			throw new Error(message);
		};
		const broken = defineStore({
			state: (): { label: string } => fail("state failure"),
			computed: (): { upper: () => string } => fail("computed failure"),
			actions: (): { run: () => void } => fail("actions failure"),
			effects: () => fail("effects failure"),
			init: () => {
				throw new Error("init failure");
			},
		});

		expect(() =>
			Catalyst.start({ stores: { broken }, reactions: [dom] }),
		).not.toThrow();
		expect(Runtime.started).toBe(true);
		expect(Runtime.removalObserver).toBeDefined();
		expect(document.querySelector("#broken")?.textContent).toBe("html state");
		expect(document.querySelector("#healthy")?.textContent).toBe("ok");
	});

	it("completes destroy when a store cleanup throws", () => {
		allowConsoleErrors();
		document.body.innerHTML = `<div data-store="c1"></div><div data-store="c2"></div>`;
		let secondCleanedUp = false;
		Catalyst.start({
			stores: {
				c1: defineStore({
					init: () => () => {
						throw new Error("cleanup failure");
					},
				}),
				c2: defineStore({
					init: () => () => {
						secondCleanedUp = true;
					},
				}),
			},
		});

		expect(() => Catalyst.destroy()).not.toThrow();
		expect(Runtime.started).toBe(false);
		expect(Runtime.stores.size).toBe(0);
		expect(secondCleanedUp).toBe(true);
	});

	it("re-binds references outside a refreshed store", async () => {
		document.body.innerHTML = `
			<div data-store="a" data-state--label="one"></div>
			<span data-dom--text="a:$label"></span>
			<button data-ref="a:#trigger"></button>
		`;
		Catalyst.start({ reactions: [dom] });
		Catalyst.refresh("a");

		expect(getStore("a")?.refs.get("trigger")).toBe(
			document.querySelector("button"),
		);
		setStoreState("a", "label", "two");
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("two");
	});

	it("initialises directives once a store they reference appears", () => {
		document.body.innerHTML = `
			<span data-dom--text="late:$label"></span>
			<div id="host"></div>
		`;
		Catalyst.start({ reactions: [dom] });
		expect(document.querySelector("span")?.textContent).not.toBe("ready");

		const host = document.querySelector("#host");
		if (!host) throw new Error("Missing host");
		host.innerHTML = `<div data-store="late" data-state--label="ready"></div>`;
		Catalyst.sync(host);
		expect(document.querySelector("span")?.textContent).toBe("ready");
	});

	it("does not bind a duplicate store's directives to the first instance", () => {
		document.body.innerHTML = `
			<div data-store="dup" data-state--value="first"></div>
			<div data-store="dup" data-state--value="second">
				<span data-dom--text="$value"></span>
			</div>
		`;
		Catalyst.start({ reactions: [dom] });

		expect(document.querySelector("span")?.textContent).not.toBe("first");
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('"dup" is already used by another element'),
		);
	});

	it("leaves a duplicate store's directives unbound", async () => {
		document.body.innerHTML = `
			<div data-store="dup" data-state--value="first">
				<span id="first" data-dom--text="$value"></span>
			</div>
			<div data-store="dup" data-state--value="second">
				<span id="second" data-dom--text="$value">server text</span>
				<button data-events--click="@report"></button>
			</div>
		`;
		let reports = 0;
		const dup = defineStore({
			actions: () => ({
				report: () => {
					reports += 1;
				},
			}),
		});
		Catalyst.start({ stores: { dup }, reactions: [dom, events] });

		expect(document.querySelector("#first")?.textContent).toBe("first");
		expect(document.querySelector("#second")?.textContent).toBe("server text");
		document.querySelector<HTMLButtonElement>("button")?.click();
		await settle();
		expect(reports).toBe(0);
		expect(catalystWarnings()).toEqual([
			expect.stringContaining('"dup" is already used by another element'),
		]);
	});

	it("leaves directives for a missing store untouched until it exists", async () => {
		document.body.innerHTML = `
			<span data-dom--text="late:$label">waiting</span>
			<button data-events--click="late:@ping"></button>
			<div id="host"></div>
		`;
		let pings = 0;
		const late = defineStore({
			state: { label: "" },
			actions: () => ({
				ping: () => {
					pings += 1;
				},
			}),
		});
		Catalyst.start({ stores: { late }, reactions: [dom, events] });
		const span = document.querySelector("span");
		const button = document.querySelector("button");
		const host = document.querySelector("#host");
		if (!span || !button || !host) throw new Error("Missing markup");

		expect(span.textContent).toBe("waiting");
		button.click();
		expect(pings).toBe(0);
		expect(catalystWarnings()).toEqual([]);

		host.innerHTML = `<div data-store="late" data-state--label="ready"></div>`;
		Catalyst.sync(host);
		expect(span.textContent).toBe("ready");
		button.click();
		expect(pings).toBe(1);

		// Removing the store leaves the directives waiting for a new one.
		host.innerHTML = "";
		await settle();
		button.click();
		expect(pings).toBe(1);
		expect(span.textContent).toBe("ready");
		expect(catalystWarnings()).toEqual([]);

		host.innerHTML = `<div data-store="late" data-state--label="again"></div>`;
		Catalyst.sync(host);
		expect(span.textContent).toBe("again");
		button.click();
		expect(pings).toBe(2);
	});

	it("replaces a store's markup and syncs it in the same task", async () => {
		document.body.innerHTML = `<div id="slot"></div>`;
		const cleanups: string[] = [];
		const injected = defineStore({
			state: { label: "" },
			init: ({ state }) => () => cleanups.push(state.label),
		});
		Catalyst.start({ stores: { injected }, reactions: [dom] });
		const slot = document.querySelector("#slot");
		if (!slot) throw new Error("Missing slot");

		slot.innerHTML = `<div data-store="injected" data-state--label="one"><span data-dom--text="$label"></span></div>`;
		Catalyst.sync(slot);
		slot.innerHTML = `<div data-store="injected" data-state--label="two"><span data-dom--text="$label"></span></div>`;
		Catalyst.sync(slot);

		expect(slot.querySelector("span")?.textContent).toBe("two");
		expect(getStore("injected")?.element).toBe(slot.firstElementChild);
		expect(cleanups).toEqual(["one"]);
		await settle();
		expect(getStore("injected")?.element).toBe(slot.firstElementChild);
		expect(catalystWarnings()).toEqual([]);
	});

	it("replaces a store when its data-store value changes", () => {
		document.body.innerHTML = `
			<div data-store="before" data-state--label="value">
				<span data-dom--text="$label"></span>
			</div>
		`;
		let cleanups = 0;
		const before = defineStore({
			init: () => () => {
				cleanups += 1;
			},
		});
		Catalyst.start({ stores: { before }, reactions: [dom] });

		const root = document.querySelector("[data-store]");
		root?.setAttribute("data-store", "after");
		if (root) Catalyst.sync(root);

		expect(cleanups).toBe(1);
		expect(Runtime.stores.has("before")).toBe(false);
		expect(getStore("after")?.element).toBe(root);
		expect(document.querySelector("span")?.textContent).toBe("value");
	});

	it("adds stores after start and rebuilds a store already on the page", async () => {
		document.body.innerHTML = `
			<div data-store="early" data-state--label="from markup">
				<span data-dom--text="$label"></span>
				<button data-events--click="@shout"></button>
			</div>
		`;
		Catalyst.start({ reactions: [dom, events] });
		expect(document.querySelector("span")?.textContent).toBe("from markup");

		Catalyst.add({
			stores: {
				early: defineStore({
					state: { label: "" },
					actions: ({ state, setState }) => ({
						shout: () =>
							setState((draft) => {
								draft.label = state.label.toUpperCase();
							}),
					}),
				}),
			},
		});
		document.querySelector("button")?.click();
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("FROM MARKUP");
	});

	it("warns when a different definition is registered for a scope", () => {
		const first = defineStore({});
		Catalyst.start({ stores: { taken: first } });
		Catalyst.add({ stores: { taken: first } });
		expect(catalystWarnings()).toEqual([]);

		Catalyst.add({ stores: { taken: defineStore({}) } });
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('already registered for scope "taken"'),
		);
	});

	it("reports first-party reactions that aren't registered in debug mode", () => {
		document.body.innerHTML = `
			<div data-store="debugged" data-state--items="[]">
				<ul data-loop="$items"><template><li></li></template></ul>
				<ol data-loop="$items"><template><li></li></template></ol>
				<span data-dom--text="$items"></span>
			</div>
		`;
		Catalyst.start({ debug: true, reactions: [dom] });
		const reports = catalystWarnings().filter((message) =>
			message.includes("reaction isn't registered"),
		);
		expect(reports).toEqual([
			'[Catalyst] Found "data-loop" but the loop reaction isn\'t registered. Add loop to Catalyst.start({ reactions }).',
		]);

		Catalyst.destroy();
		Catalyst.start({ reactions: [loop] });
		expect(
			catalystWarnings().filter((message) =>
				message.includes("reaction isn't registered"),
			),
		).toHaveLength(1);
	});

	it("waits for the body when started too early", () => {
		const body = document.body;
		body.innerHTML = `<div data-store="deferred" data-state--label="ready"><span data-dom--text="$label"></span></div>`;
		body.remove();

		Catalyst.start({ reactions: [dom] });
		expect(Runtime.started).toBe(false);

		document.documentElement.append(body);
		document.dispatchEvent(new Event("DOMContentLoaded"));
		expect(Runtime.started).toBe(true);
		expect(document.querySelector("span")?.textContent).toBe("ready");
	});

	it("applies bindings before start and sync return", () => {
		document.body.innerHTML = `
			<div data-store="now" data-state--label="ready">
				<span data-dom--text="$label"></span>
				<button data-events--click="@missing"></button>
			</div>
		`;
		Catalyst.start({ reactions: [dom, events] });
		expect(document.querySelector("span")?.textContent).toBe("ready");
	});
});
