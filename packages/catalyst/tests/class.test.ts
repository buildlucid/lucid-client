import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { classes, loop } from "../src/reactions.js";
import { catalystWarnings, getStore, setStoreState, settle } from "./utils.js";

const classNames = (selector: string) =>
	Array.from(document.querySelector(selector)?.classList ?? []);

describe("class reaction", () => {
	it("toggles one class and keeps the element's other classes", async () => {
		document.body.innerHTML = `
			<div data-store="c" data-state--open="false">
				<nav id="nav" class="menu" data-class--is-open="$open"></nav>
			</div>
		`;
		Catalyst.init({ reactions: [classes] });
		expect(classNames("#nav")).toEqual(["menu"]);

		setStoreState("c", "open", true);
		await settle();
		expect(classNames("#nav")).toEqual(["menu", "is-open"]);

		setStoreState("c", "open", false);
		await settle();
		expect(classNames("#nav")).toEqual(["menu"]);
	});

	it("applies strings, arrays and objects, removing only classes it applied", async () => {
		document.body.innerHTML = `
			<div data-store="c">
				<button id="tab" class="tab" data-class="$classes"></button>
			</div>
		`;
		const c = defineStore({
			state: { classes: "active bold" as unknown },
		});
		Catalyst.init({ stores: { c }, reactions: [classes] });
		expect(classNames("#tab")).toEqual(["tab", "active", "bold"]);

		setStoreState("c", "classes", ["active", "big wide"]);
		await settle();
		expect(classNames("#tab")).toEqual(["tab", "active", "big", "wide"]);

		setStoreState("c", "classes", { active: false, muted: true });
		await settle();
		expect(classNames("#tab")).toEqual(["tab", "muted"]);

		// Changing an object in place updates the classes.
		getStore("c")?.setState((state) => {
			(state.classes as Record<string, boolean>).active = true;
		});
		await settle();
		expect(classNames("#tab")).toEqual(["tab", "muted", "active"]);

		setStoreState("c", "classes", null);
		await settle();
		expect(classNames("#tab")).toEqual(["tab"]);
	});

	it("computes classes for each loop item from an action", async () => {
		document.body.innerHTML = `
			<ul data-store="list" data-loop="$items">
				<template><li data-class="@itemClass"></li></template>
			</ul>
		`;
		const list = defineStore({
			state: { items: ["a", "b"], selected: "b" },
			actions: ({ state }) => ({
				itemClass: ({ item }: { item: string }) => ({
					selected: item === state.selected,
				}),
			}),
		});
		Catalyst.init({ stores: { list }, reactions: [classes, loop] });
		const items = () =>
			Array.from(document.querySelectorAll("li"), (li) => li.className);
		expect(items()).toEqual(["", "selected"]);

		setStoreState("list", "selected", "a");
		await settle();
		expect(items()).toEqual(["selected", ""]);
	});

	it("restores the element's classes when the directive is disposed", async () => {
		document.body.innerHTML = `
			<div data-store="c" data-state--on="false">
				<p id="p" class="shown" data-class--shown="$on" data-class--extra="true"></p>
			</div>
		`;
		Catalyst.init({ reactions: [classes] });
		expect(classNames("#p")).toEqual([]);

		const p = document.querySelector("#p");
		p?.removeAttribute("data-class--shown");
		Catalyst.sync(document.body);
		expect(classNames("#p")).toEqual(["shown"]);
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining(
				'"data-class--extra" directive requires a state or action reference',
			),
		);
	});

	it("warns about values that name no class", async () => {
		document.body.innerHTML = `
			<div data-store="c" data-state--count="3">
				<p data-class="$count"></p>
			</div>
		`;
		Catalyst.init({ reactions: [classes] });
		await settle();
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining("must resolve to a string"),
		);
	});

	it("keeps classes the markup had when a list stops naming them", async () => {
		document.body.innerHTML = `
			<div data-store="c">
				<p id="p" class="base" data-class="$classes"></p>
			</div>
		`;
		const c = defineStore({
			state: { classes: "base extra" as string | null },
		});
		Catalyst.init({ stores: { c }, reactions: [classes] });
		expect(classNames("#p")).toEqual(["base", "extra"]);

		setStoreState("c", "classes", null);
		await settle();
		expect(classNames("#p")).toEqual(["base"]);
	});

	it("keeps a class while another class directive still applies it", async () => {
		document.body.innerHTML = `
			<div data-store="c">
				<p id="p" data-class="$list" data-class--foo="$active"></p>
			</div>
		`;
		const c = defineStore({
			state: { list: "foo" as string | null, active: true },
		});
		Catalyst.init({ stores: { c }, reactions: [classes] });
		expect(classNames("#p")).toEqual(["foo"]);

		setStoreState("c", "list", null);
		await settle();
		expect(classNames("#p")).toEqual(["foo"]);

		setStoreState("c", "active", false);
		await settle();
		expect(classNames("#p")).toEqual([]);
	});

	it("restores the markup's classes whichever directive applied a class first", async () => {
		document.body.innerHTML = `
			<div data-store="c">
				<p id="p" data-class--selected="$selected" data-class="$extra"></p>
			</div>
		`;
		const c = defineStore({
			state: { selected: true, extra: "selected" as string | null },
		});
		Catalyst.init({ stores: { c }, reactions: [classes] });
		expect(classNames("#p")).toEqual(["selected"]);

		getStore("c")?.setState((state) => {
			state.selected = false;
			state.extra = null;
		});
		await settle();
		expect(classNames("#p")).toEqual([]);
	});
});
