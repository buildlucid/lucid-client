import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore, flush, snapshot } from "../src/index.js";
import { bind, dom, loop } from "../src/reactions.js";
import { catalystWarnings, getStore, settle } from "./utils.js";

type Item = { id: number; title: string };

const items = (): Item[] => [
	{ id: 1, title: "One" },
	{ id: 2, title: "Two" },
	{ id: 3, title: "Three" },
];

const texts = (selector: string) =>
	Array.from(document.querySelectorAll(selector), (element) =>
		element.textContent?.trim(),
	);

describe("store state", () => {
	it("returns the previous value until the next flush, then the new one", () => {
		document.body.innerHTML = `<div data-store="profile"></div>`;
		let seen: unknown[] = [];
		const profile = defineStore({
			state: { count: 0, user: { name: "Ada" } },
			actions: ({ state, setState }) => ({
				rename: () => {
					setState((draft) => {
						draft.count += 1;
						draft.count += 1;
						draft.user.name = "Grace";
						seen = [draft.count, draft.user.name];
					});
					seen.push(state.count, state.user.name);
					flush();
					seen.push(state.count, state.user.name);
				},
			}),
		});
		Catalyst.start({ stores: { profile } });

		getStore("profile")?.actions.rename?.();
		expect(seen).toEqual([2, "Grace", 0, "Ada", 2, "Grace"]);
	});

	it("keeps items when a filtered array is written back, and snapshots plain data", async () => {
		document.body.innerHTML = `
			<ul data-store="list" data-loop="$items">
				<template><li data-dom--text="$item.title"></li></template>
			</ul>
		`;
		const list = defineStore({
			state: { items: items() },
			actions: ({ state, setState }) => ({
				removeFirst: () =>
					setState((draft) => {
						draft.items = draft.items.filter((item) => item.id !== 1);
					}),
				copy: () => structuredClone(snapshot(state.items)),
			}),
		});
		Catalyst.start({ stores: { list }, reactions: [dom, loop] });
		const [, second, third] = Array.from(document.querySelectorAll("li"));

		getStore("list")?.actions.removeFirst?.();
		await settle();

		expect(Array.from(document.querySelectorAll("li"))).toEqual([
			second,
			third,
		]);
		expect(getStore("list")?.actions.copy?.()).toEqual([
			{ id: 2, title: "Two" },
			{ id: 3, title: "Three" },
		]);
	});

	it("snapshots a whole store's state without its computed values", () => {
		document.body.innerHTML = `<div data-store="form" data-state--seats="2"></div>`;
		const form = defineStore({
			state: { seats: 1, tags: ["a"] },
			computed: ({ state }) => ({ label: () => `${state.seats} seats` }),
			actions: ({ state }) => ({
				save: () => structuredClone(snapshot(state)),
			}),
		});
		Catalyst.start({ stores: { form } });

		expect(getStore("form")?.actions.save?.()).toEqual({
			seats: 2,
			tags: ["a"],
		});
	});

	it("updates readers when array items are removed with splice, pop or length", async () => {
		document.body.innerHTML = `
			<div data-store="list">
				<p data-dom--text="$items.length"></p>
				<p id="last" data-dom--text="$items[2].title"></p>
				<ul data-loop="$items">
					<template><li data-dom--text="$item.title"></li></template>
				</ul>
			</div>
		`;
		const list = defineStore({
			state: { items: items() },
			actions: ({ setState }) => ({
				splice: () =>
					setState((draft) => {
						draft.items.splice(0, 1);
					}),
				pop: () =>
					setState((draft) => {
						draft.items.pop();
					}),
				truncate: () =>
					setState((draft) => {
						draft.items.length = 0;
					}),
			}),
		});
		Catalyst.start({ stores: { list }, reactions: [dom, loop] });
		const actions = getStore("list")?.actions;

		actions?.splice?.();
		await settle();
		expect(texts("li")).toEqual(["Two", "Three"]);
		expect(texts("p")).toEqual(["2", ""]);

		actions?.pop?.();
		await settle();
		expect(texts("li")).toEqual(["Two"]);

		actions?.truncate?.();
		await settle();
		expect(texts("li")).toEqual([]);
		expect(texts("p")).toEqual(["0", ""]);
	});

	it("updates readers of keys when a property is added or deleted", async () => {
		document.body.innerHTML = `
			<div data-store="tags">
				<p id="names" data-dom--text="$names"></p>
				<p id="has" data-bind--data-has="$hasRed"></p>
			</div>
		`;
		const tags = defineStore({
			state: { colours: { blue: 1 } as Record<string, number> },
			computed: ({ state }) => ({
				names: () => Object.keys(state.colours).join(","),
				hasRed: () => "red" in state.colours,
			}),
			actions: ({ setState }) => ({
				add: () =>
					setState((draft) => {
						draft.colours.red = 2;
					}),
				remove: () =>
					setState((draft) => {
						delete draft.colours.blue;
					}),
			}),
		});
		Catalyst.start({ stores: { tags }, reactions: [bind, dom] });
		const actions = getStore("tags")?.actions;
		const has = () => document.querySelector("#has")?.getAttribute("data-has");

		expect(texts("#names")).toEqual(["blue"]);
		expect(has()).toBe("false");

		actions?.add?.();
		await settle();
		expect(texts("#names")).toEqual(["blue,red"]);
		expect(has()).toBe("true");

		actions?.remove?.();
		await settle();
		expect(texts("#names")).toEqual(["red"]);
	});

	it("rejects nested writes outside setState", () => {
		document.body.innerHTML = `<div data-store="list"></div>`;
		const list = defineStore({
			state: { items: items() },
			actions: ({ state }) => ({
				write: () => {
					(state.items[0] as Item).title = "Changed";
				},
			}),
		});
		Catalyst.start({ stores: { list } });

		getStore("list")?.actions.write?.();
		flush();
		expect(snapshot(getStore("list")?.state.items)).toEqual(items());
		expect(catalystWarnings()).toEqual([
			'[Catalyst] Cannot write "title" directly. Use setState((state) => { state.title = value; }).',
		]);
	});

	it("stores functions, class instances and promises as they are", () => {
		document.body.innerHTML = `<div data-store="values"></div>`;
		const format = (value: number) => `${value}%`;
		const date = new Date(0);
		const pending = Promise.resolve(1);
		const values = defineStore({
			state: () => ({ format, date, pending }),
			actions: ({ setState }) => ({
				replace: (next: (value: number) => string) =>
					setState((draft) => {
						draft.format = next;
					}),
			}),
		});
		Catalyst.start({ stores: { values } });
		const store = getStore("values");

		expect(store?.state.format).toBe(format);
		expect(store?.state.date).toBe(date);
		expect(store?.state.pending).toBe(pending);

		const next = (value: number) => `${value} percent`;
		store?.actions.replace?.(next);
		flush();
		expect(store?.state.format).toBe(next);
	});
});
