import { createSignal } from "solid-js";
import { describe, expect, it } from "vite-plus/test";
import Catalyst, { storeModule } from "../src/index.js";
import { events, bind, dom, loop } from "../src/reactions.js";
import Runtime from "../src/runtime/catalyst.js";
import { settle } from "./utils.js";

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

		let setItems: ReturnType<typeof createSignal<Link[]>>[1] | undefined;
		let selections = 0;
		type Link = { title: string; url: string };
		storeModule("links", {
			state: () => {
				const items = createSignal<Link[]>([
					{ title: "One", url: "/one" },
					{ title: "Two", url: "/two" },
				]);
				setItems = items[1];
				return { items };
			},
			setup: () => ({
				actions: {
					select: () => {
						selections += 1;
					},
				},
			}),
		});

		Catalyst.start({ reactions: [loop, bind, dom, events] });
		await settle();

		let links = Array.from(document.querySelectorAll("ul > li > a"));
		expect(links.map((link) => link.textContent)).toEqual(["One", "Two"]);
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/one",
			"/two",
		]);
		expect(links.map((link) => link.getAttribute("data-index"))).toEqual([
			"0",
			"1",
		]);
		expect(links.map((link) => link.getAttribute("data-index-one"))).toEqual([
			"1",
			"2",
		]);

		setItems?.([
			{ title: "One updated", url: "/one-updated" },
			{ title: "Two", url: "/two" },
			{ title: "Three", url: "/three" },
		]);
		await settle();

		links = Array.from(document.querySelectorAll("ul > li > a"));
		expect(links.map((link) => link.textContent)).toEqual([
			"One updated",
			"Two",
			"Three",
		]);
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/one-updated",
			"/two",
			"/three",
		]);

		links[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
		storeModule("navigation", {
			state: () => ({
				groups: createSignal<Group[]>([
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
				]),
			}),
			setup: () => ({ actions: {} }),
		});

		Catalyst.start({ reactions: [loop, bind, dom] });
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
		let setItems: ReturnType<typeof createSignal<Item[]>>[1] | undefined;
		storeModule("action-loop", {
			state: () => {
				const items = createSignal<Item[]>([{ title: "One" }]);
				setItems = items[1];
				return { items };
			},
			setup: (store) => ({
				actions: { getItems: () => store.state.items[0]() },
			}),
		});

		Catalyst.start({ reactions: [loop, dom] });
		await settle();
		expect(
			Array.from(document.querySelectorAll("li")).map(
				(element) => element.textContent,
			),
		).toEqual(["One"]);

		setItems?.([{ title: "Two" }, { title: "Three" }]);
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

		storeModule("tree", {
			state: () => ({
				groups: createSignal([
					{
						title: "Group",
						sections: [{ title: "Section", links: [{ title: "Link" }] }],
					},
				]),
			}),
			setup: () => ({ actions: {} }),
		});

		Catalyst.start({ reactions: [loop, bind, dom] });
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
		const one = { title: "One" };
		const two = { title: "Two" };
		const three = { title: "Three" };
		storeModule("keyed", {
			state: () => ({ items: createSignal([one, two]) }),
			setup: () => ({ actions: {} }),
		});
		Catalyst.start({ reactions: [loop, bind, dom] });

		const [firstOne, firstTwo] = Array.from(document.querySelectorAll("li"));
		Runtime.stores.get("keyed")?.state.items?.[1]([three, two, one]);
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

	it("clears rendered items when the value becomes nullish", async () => {
		document.body.innerHTML = `
			<div data-store="nullable">
				<ul data-loop="$items"><template><li></li></template></ul>
			</div>
		`;
		storeModule("nullable", {
			state: () => ({ items: createSignal<number[] | null>([1, 2]) }),
			setup: () => ({ actions: {} }),
		});
		Catalyst.start({ reactions: [loop] });
		expect(document.querySelectorAll("li")).toHaveLength(2);

		Runtime.stores.get("nullable")?.state.items?.[1](null);
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
		storeModule("list", {
			state: () => ({ items: createSignal([1]) }),
			setup: () => ({ actions: {} }),
		});
		storeModule("child", {
			state: () => ({ count: createSignal(0) }),
			setup: (store) => ({
				actions: {
					init: () => {
						inits += 1;
						store.state.count[0]();
					},
				},
			}),
		});
		Catalyst.start({ reactions: [loop] });

		const child = Runtime.stores.get("child");
		child?.state.count?.[1](5);
		await settle();
		expect(inits).toBe(1);
		expect(Runtime.stores.get("child")).toBe(child);
		expect(child?.state.count?.[0]()).toBe(5);
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
		storeModule("ssr", {
			state: () => ({ items: createSignal([1]) }),
			setup: () => ({
				actions: {
					ping: () => {
						pings += 1;
					},
				},
			}),
		});
		Catalyst.start({ reactions: [loop, events] });
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
