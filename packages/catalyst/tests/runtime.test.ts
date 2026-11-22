import { describe, expect, it } from "vite-plus/test";
import Catalyst, { createSignal, storeModule } from "../src/index.js";
import { dom, events, refs } from "../src/reactions.js";
import Runtime from "../src/runtime/catalyst.js";
import { allowConsoleErrors, catalystWarnings, settle } from "./utils.js";

describe("runtime robustness", () => {
	it("isolates a store module whose setup throws", () => {
		allowConsoleErrors();
		document.body.innerHTML = `
			<div data-store="broken" data-state--label="html state">
				<span id="broken" data-dom--text="$label"></span>
			</div>
			<div data-store="healthy" data-state--label="ok">
				<span id="healthy" data-dom--text="$label"></span>
			</div>
		`;
		storeModule("broken", {
			setup: () => {
				throw new Error("setup failure");
			},
		});

		expect(() => Catalyst.start({ reactions: [dom] })).not.toThrow();
		expect(Runtime.started).toBe(true);
		expect(Runtime.removalObserver).toBeDefined();
		expect(document.querySelector("#broken")?.textContent).toBe("html state");
		expect(document.querySelector("#healthy")?.textContent).toBe("ok");
	});

	it("completes destroy when a store cleanup throws", () => {
		allowConsoleErrors();
		document.body.innerHTML = `<div data-store="c1"></div><div data-store="c2"></div>`;
		let secondCleanedUp = false;
		storeModule("c1", {
			setup: () => ({
				actions: {},
				cleanup: () => {
					throw new Error("cleanup failure");
				},
			}),
		});
		storeModule("c2", {
			setup: () => ({
				actions: {},
				cleanup: () => {
					secondCleanedUp = true;
				},
			}),
		});
		Catalyst.start();

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
		Catalyst.start({ reactions: [dom, refs] });
		Catalyst.refresh("a");

		const store = Runtime.stores.get("a");
		expect(store?.refs.get("trigger")).toBe(document.querySelector("button"));
		store?.state.label?.[1]("two");
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("two");
	});

	it("initialises directives once a store they reference appears", async () => {
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

	it("replaces a store when its data-store value changes", () => {
		document.body.innerHTML = `
			<div data-store="before" data-state--label="value">
				<span data-dom--text="$label"></span>
			</div>
		`;
		let cleanups = 0;
		storeModule("before", {
			setup: () => ({
				actions: {},
				cleanup: () => {
					cleanups += 1;
				},
			}),
		});
		Catalyst.start({ reactions: [dom] });

		const root = document.querySelector("[data-store]");
		root?.setAttribute("data-store", "after");
		if (root) Catalyst.sync(root);

		expect(cleanups).toBe(1);
		expect(Runtime.stores.has("before")).toBe(false);
		expect(Runtime.stores.get("after")?.element).toBe(root);
		expect(document.querySelector("span")?.textContent).toBe("value");
	});

	it("warns when a module is registered after its store exists", () => {
		document.body.innerHTML = `<div data-store="early"></div>`;
		Catalyst.start();
		storeModule("early", {
			state: () => ({ label: createSignal("late") }),
			setup: () => ({ actions: {} }),
		});
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('Call Catalyst.refresh("early")'),
		);
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
