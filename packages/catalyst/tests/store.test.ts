import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { bind, dom, events } from "../src/reactions.js";
import { catalystWarnings, getStore, setStoreState, settle } from "./utils.js";

const click = (selector: string) =>
	document
		.querySelector(selector)
		?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("defineStore", () => {
	it("connects state, computed values and actions to markup", async () => {
		document.body.innerHTML = `
			<div data-store="counter">
				<button data-events--click="@increment" data-bind--aria-label="$label">
					<span id="count" data-dom--text="$count"></span>
					<span id="double" data-dom--text="$double"></span>
				</button>
			</div>
		`;
		const counter = defineStore({
			state: { count: 1 },
			computed: ({ state }) => ({
				double: () => state.count * 2,
				label: () => `Count is ${state.count}`,
			}),
			actions: ({ setState }) => ({
				increment: () =>
					setState((state) => {
						state.count += 1;
					}),
			}),
		});
		Catalyst.start({ stores: { counter }, reactions: [bind, dom, events] });

		expect(document.querySelector("#count")?.textContent).toBe("1");
		expect(document.querySelector("#double")?.textContent).toBe("2");

		click("button");
		await settle();
		expect(document.querySelector("#count")?.textContent).toBe("2");
		expect(document.querySelector("#double")?.textContent).toBe("4");
		expect(document.querySelector("button")?.getAttribute("aria-label")).toBe(
			"Count is 2",
		);
	});

	it("recomputes a computed value only when the state it reads changes", async () => {
		document.body.innerHTML = `
			<div data-store="memo">
				<span id="a" data-dom--text="$upper"></span>
				<span id="b" data-dom--text="$upper"></span>
			</div>
		`;
		let computations = 0;
		const memo = defineStore({
			state: { name: "ada", unrelated: 0 },
			computed: ({ state }) => ({
				upper: () => {
					computations += 1;
					return state.name.toUpperCase();
				},
			}),
		});
		Catalyst.start({ stores: { memo }, reactions: [dom] });
		expect(document.querySelector("#a")?.textContent).toBe("ADA");
		expect(computations).toBe(1);

		setStoreState("memo", "unrelated", 1);
		await settle();
		expect(computations).toBe(1);

		setStoreState("memo", "name", "grace");
		await settle();
		expect(document.querySelector("#b")?.textContent).toBe("GRACE");
		expect(computations).toBe(2);
	});

	it("exposes computed values on state to actions and init", () => {
		document.body.innerHTML = `<div data-store="derived"></div>`;
		let seen: string | undefined;
		let fromAction: string | undefined;
		const derived = defineStore({
			state: { first: "Ada", last: "Lovelace" },
			computed: ({ state }) => ({
				fullName: () => `${state.first} ${state.last}`,
			}),
			actions: ({ state }) => ({
				read: () => {
					fromAction = state.fullName;
				},
			}),
			init: ({ state, actions }) => {
				seen = state.fullName;
				actions.read();
			},
		});
		Catalyst.start({ stores: { derived } });
		expect(seen).toBe("Ada Lovelace");
		expect(fromAction).toBe("Ada Lovelace");
		expect(Object.keys(getStore("derived")?.state ?? {})).toEqual([
			"first",
			"last",
			"fullName",
		]);
	});

	it("starts every instance from a copy of the state", async () => {
		document.body.innerHTML = `
			<div data-store="login"></div>
			<div data-store="signup"></div>
		`;
		const dialog = defineStore({
			state: { open: false, tags: ["a"] },
			actions: ({ setState }) => ({
				open: () =>
					setState((state) => {
						state.open = true;
						state.tags.push("opened");
					}),
			}),
		});
		Catalyst.start({ stores: { login: dialog, signup: dialog } });

		getStore("login")?.actions.open?.();
		await settle();
		expect(getStore("login")?.state.open).toBe(true);
		expect(getStore("signup")?.state.open).toBe(false);
		expect(getStore("signup")?.state.tags).toEqual(["a"]);

		Catalyst.refresh("login");
		expect(getStore("login")?.state.open).toBe(false);
		expect(getStore("login")?.state.tags).toEqual(["a"]);
	});

	it("accepts a function for state that can't be copied", () => {
		document.body.innerHTML = `<div data-store="factory"></div>`;
		class Point {
			constructor(
				public x: number,
				public y: number,
			) {}
		}
		const factory = defineStore({
			state: () => ({ origin: new Point(0, 0) }),
		});
		Catalyst.start({ stores: { factory } });
		expect(getStore("factory")?.state.origin).toBeInstanceOf(Point);
	});

	it("warns when state is written directly", () => {
		document.body.innerHTML = `<div data-store="direct"></div>`;
		const direct = defineStore({
			state: { count: 0 },
			actions: ({ state }) => ({
				write: () => {
					(state as { count: number }).count = 1;
				},
			}),
		});
		Catalyst.start({ stores: { direct } });
		getStore("direct")?.actions.write?.();
		expect(getStore("direct")?.state.count).toBe(0);
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('Cannot write "count" on store "direct"'),
		);
	});

	it("warns when a computed value hides a state value", () => {
		document.body.innerHTML = `<div data-store="shadow" data-state--label="html"></div>`;
		const shadow = defineStore({
			computed: () => ({ label: () => "computed" }),
		});
		Catalyst.start({ stores: { shadow } });
		expect(getStore("shadow")?.state.label).toBe("computed");
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('The computed value "label" on store "shadow"'),
		);
	});
});

describe("store init", () => {
	it("can write state and returns a cleanup for when the store is destroyed", async () => {
		document.body.innerHTML = `
			<div id="host" data-store="lifecycle">
				<span data-dom--text="$status"></span>
			</div>
		`;
		const events: string[] = [];
		const lifecycle = defineStore({
			state: { status: "idle" },
			init: ({ setState }) => {
				events.push("init");
				setState((state) => {
					state.status = "ready";
				});
				return () => events.push("cleanup");
			},
		});
		Catalyst.start({ stores: { lifecycle }, reactions: [dom] });
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("ready");
		expect(events).toEqual(["init"]);

		document.querySelector("#host")?.remove();
		await settle();
		expect(events).toEqual(["init", "cleanup"]);
	});

	it("runs a cleanup returned by an async init", async () => {
		document.body.innerHTML = `<div data-store="async"></div>`;
		let cleanups = 0;
		const asyncStore = defineStore({
			init: async () => {
				await Promise.resolve();
				return () => {
					cleanups += 1;
				};
			},
		});
		Catalyst.start({ stores: { async: asyncStore } });
		await settle();
		Catalyst.destroy();
		expect(cleanups).toBe(1);
	});
});
