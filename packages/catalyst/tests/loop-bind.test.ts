import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { events, bind, dom, loop } from "../src/reactions.js";
import Runtime from "../src/runtime/catalyst.js";
import { getStore, setStoreState, settle } from "./utils.js";

describe("bindings rendered by loops", () => {
	it("runs bindings against store-module array state", async () => {
		document.body.innerHTML = `
			<div data-store="links">
				<ul data-loop="$items">
					<template>
						<li>
							<a
								data-bind--href="$item.url"
								data-bind--data-index="$index"
								data-bind--data-index-one="$indexOne"
								data-dom--text="$item.title"
								data-events--click="@select"
							></a>
						</li>
					</template>
				</ul>
			</div>
		`;

		let selections = 0;
		type Link = { title: string; url: string };
		const links = defineStore({
			state: {
				items: [
					{ title: "One", url: "/one" },
					{ title: "Two", url: "/two" },
				] as Link[],
			},
			actions: () => ({
				select: () => {
					selections += 1;
				},
			}),
		});

		Catalyst.start({ stores: { links }, reactions: [loop, bind, dom, events] });
		await settle();

		let anchors = Array.from(document.querySelectorAll("ul > li > a"));
		expect(anchors.map((link) => link.textContent)).toEqual(["One", "Two"]);
		expect(anchors.map((link) => link.getAttribute("href"))).toEqual([
			"/one",
			"/two",
		]);
		expect(anchors.map((link) => link.getAttribute("data-index"))).toEqual([
			"0",
			"1",
		]);
		expect(anchors.map((link) => link.getAttribute("data-index-one"))).toEqual([
			"1",
			"2",
		]);

		setStoreState("links", "items", [
			{ title: "One updated", url: "/one-updated" },
			{ title: "Two", url: "/two" },
			{ title: "Three", url: "/three" },
		]);
		await settle();

		anchors = Array.from(document.querySelectorAll("ul > li > a"));
		expect(anchors.map((link) => link.textContent)).toEqual([
			"One updated",
			"Two",
			"Three",
		]);
		expect(anchors.map((link) => link.getAttribute("href"))).toEqual([
			"/one-updated",
			"/two",
			"/three",
		]);

		anchors[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(selections).toBe(1);
	});

	it("keeps parent and child indexes isolated in nested loops", async () => {
		document.body.innerHTML = `
			<div data-store="navigation">
				<ul id="groups" data-loop="$groups">
					<template>
						<li>
							<span data-dom--text="$item.title"></span>
							<ul data-loop="$item.links">
								<template>
									<li>
										<a
											data-bind--href="$item.url"
											data-bind--data-group="$parent.item.title"
											data-bind--data-group-index="$parent.index"
											data-bind--data-group-index-one="$parent.indexOne"
											data-dom--text="$item.title"
										></a>
									</li>
								</template>
							</ul>
						</li>
					</template>
				</ul>
			</div>
		`;

		type Group = {
			title: string;
			links: { title: string; url: string }[];
		};
		const navigation = defineStore({
			state: {
				groups: [
					{
						title: "First",
						links: [
							{ title: "One", url: "/one" },
							{ title: "Two", url: "/two" },
						],
					},
					{
						title: "Second",
						links: [{ title: "Three", url: "/three" }],
					},
				] as Group[],
			},
		});

		Catalyst.start({ stores: { navigation }, reactions: [loop, bind, dom] });
		await settle();

		const groups = Array.from(document.querySelectorAll("#groups > li"));
		expect(groups).toHaveLength(2);
		expect(
			groups.map((group) => group.querySelector("span")?.textContent),
		).toEqual(["First", "Second"]);
		expect(
			groups.map((group) =>
				Array.from(group.querySelectorAll("a")).map((link) => ({
					text: link.textContent,
					href: link.getAttribute("href"),
				})),
			),
		).toEqual([
			[
				{ text: "One", href: "/one" },
				{ text: "Two", href: "/two" },
			],
			[{ text: "Three", href: "/three" }],
		]);
		expect(
			groups.map((group) =>
				Array.from(group.querySelectorAll("a")).map((link) => ({
					group: link.getAttribute("data-group"),
					index: link.getAttribute("data-group-index"),
					indexOne: link.getAttribute("data-group-index-one"),
				})),
			),
		).toEqual([
			[
				{ group: "First", index: "0", indexOne: "1" },
				{ group: "First", index: "0", indexOne: "1" },
			],
			[{ group: "Second", index: "1", indexOne: "2" }],
		]);
	});

	it("supports item locals for action-backed loops", async () => {
		document.body.innerHTML = `
			<div data-store="action-loop">
				<ul data-loop="@getItems">
					<template>
						<li data-dom--text="$item.title"></li>
					</template>
				</ul>
			</div>
		`;

		type Item = { title: string };
		const actionLoop = defineStore({
			state: { items: [{ title: "One" }] as Item[] },
			actions: ({ state }) => ({ getItems: () => state.items }),
		});

		Catalyst.start({
			stores: { "action-loop": actionLoop },
			reactions: [loop, dom],
		});
		await settle();
		expect(
			Array.from(document.querySelectorAll("li")).map(
				(element) => element.textContent,
			),
		).toEqual(["One"]);

		getStore("action-loop")?.setState((state) => {
			state.items = [{ title: "Two" }, { title: "Three" }];
		});
		await settle();
		expect(
			Array.from(document.querySelectorAll("li")).map(
				(element) => element.textContent,
			),
		).toEqual(["Two", "Three"]);
	});

	it("can traverse more than one parent loop context", async () => {
		document.body.innerHTML = `
			<div data-store="tree">
				<ul data-loop="$groups">
					<template>
						<li>
							<ul data-loop="$item.sections">
								<template>
									<li>
										<ul data-loop="$item.links">
											<template>
												<li
													data-bind--data-group="$parent.parent.item.title"
													data-bind--data-section="$parent.item.title"
													data-dom--text="$item.title"
												></li>
											</template>
										</ul>
									</li>
								</template>
							</ul>
						</li>
					</template>
				</ul>
			</div>
		`;

		const tree = defineStore({
			state: {
				groups: [
					{
						title: "Group",
						sections: [{ title: "Section", links: [{ title: "Link" }] }],
					},
				],
			},
		});

		Catalyst.start({ stores: { tree }, reactions: [loop, bind, dom] });
		await settle();
		const link = document.querySelector("li[data-group]");
		expect(link?.textContent).toBe("Link");
		expect(link?.getAttribute("data-group")).toBe("Group");
		expect(link?.getAttribute("data-section")).toBe("Section");
	});
});

describe("loop updates", () => {
	it("keeps markup for unchanged items and updates their index", async () => {
		document.body.innerHTML = `
			<div data-store="keyed">
				<ul data-loop="$items">
					<template>
						<li data-bind--data-index="$index" data-dom--text="$item.title"></li>
					</template>
				</ul>
			</div>
		`;
		type Item = { title: string };
		const keyed = defineStore({
			state: { items: [{ title: "One" }, { title: "Two" }] as Item[] },
		});
		Catalyst.start({ stores: { keyed }, reactions: [loop, bind, dom] });

		const [firstOne, firstTwo] = Array.from(document.querySelectorAll("li"));
		getStore("keyed")?.setState((state) => {
			const [one, two] = state.items as Item[];
			if (!one || !two) return;
			state.items = [{ title: "Three" }, two, one];
		});
		await settle();

		const items = Array.from(document.querySelectorAll("li"));
		expect(items.map((item) => item.textContent)).toEqual([
			"Three",
			"Two",
			"One",
		]);
		expect(items[1]).toBe(firstTwo);
		expect(items[2]).toBe(firstOne);
		expect(items.map((item) => item.getAttribute("data-index"))).toEqual([
			"0",
			"1",
			"2",
		]);
	});

	it("updates when items are changed in place", async () => {
		document.body.innerHTML = `
			<div data-store="mutable">
				<span data-dom--text="$items.length"></span>
				<ul data-loop="$items">
					<template><li data-dom--text="$item.title"></li></template>
				</ul>
			</div>
		`;
		type Item = { title: string };
		const mutable = defineStore({
			state: { items: [{ title: "One" }] as Item[] },
			actions: ({ setState }) => ({
				add: (title: string) =>
					setState((state) => {
						state.items.push({ title });
					}),
				rename: (index: number, title: string) =>
					setState((state) => {
						const item = state.items[index];
						if (item) item.title = title;
					}),
			}),
		});
		Catalyst.start({ stores: { mutable }, reactions: [loop, dom] });
		const [first] = Array.from(document.querySelectorAll("li"));

		getStore("mutable")?.actions.add?.("Two");
		await settle();
		let items = Array.from(document.querySelectorAll("li"));
		expect(items.map((item) => item.textContent)).toEqual(["One", "Two"]);
		expect(items[0]).toBe(first);
		expect(document.querySelector("span")?.textContent).toBe("2");

		getStore("mutable")?.actions.rename?.(0, "Uno");
		await settle();
		items = Array.from(document.querySelectorAll("li"));
		expect(items.map((item) => item.textContent)).toEqual(["Uno", "Two"]);
		expect(items[0]).toBe(first);
	});

	it("clears rendered items when the value becomes nullish", async () => {
		document.body.innerHTML = `
			<div data-store="nullable">
				<ul data-loop="$items"><template><li></li></template></ul>
			</div>
		`;
		const nullable = defineStore({
			state: { items: [1, 2] as number[] | null },
		});
		Catalyst.start({ stores: { nullable }, reactions: [loop] });
		expect(document.querySelectorAll("li")).toHaveLength(2);

		setStoreState("nullable", "items", null);
		await settle();
		expect(document.querySelectorAll("li")).toHaveLength(0);
	});

	it("does not re-render when a nested store's init reads its state", async () => {
		document.body.innerHTML = `
			<div data-store="list">
				<div data-loop="$items">
					<template><div data-store="child"></div></template>
				</div>
			</div>
		`;
		let inits = 0;
		const list = defineStore({ state: { items: [1] } });
		const child = defineStore({
			state: { count: 0 },
			init: ({ state }) => {
				inits += 1;
				void state.count;
			},
		});
		Catalyst.start({ stores: { list, child }, reactions: [loop] });

		const childStore = getStore("child");
		setStoreState("child", "count", 5);
		await settle();
		expect(inits).toBe(1);
		expect(getStore("child")).toBe(childStore);
		expect(childStore?.state.count).toBe(5);
	});

	it("replaces server-rendered children without leaking their directives", async () => {
		let pings = 0;
		document.body.innerHTML = `
			<div data-store="ssr">
				<ul data-loop="$items">
					<template><li class="rendered"></li></template>
					<li id="placeholder" data-events--document.ping="@ping"></li>
				</ul>
			</div>
		`;
		const ssr = defineStore({
			state: { items: [1] },
			actions: () => ({
				ping: () => {
					pings += 1;
				},
			}),
		});
		Catalyst.start({ stores: { ssr }, reactions: [loop, events] });
		await settle();

		expect(document.querySelector("#placeholder")).toBeNull();
		expect(document.querySelectorAll("li.rendered")).toHaveLength(1);
		document.dispatchEvent(new Event("ping"));
		expect(pings).toBe(0);
		expect(
			Array.from(Runtime.registrations.keys()).filter(
				(element) => !element.isConnected,
			),
		).toHaveLength(0);
	});
});
