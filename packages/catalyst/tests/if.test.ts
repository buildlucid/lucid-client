import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { conditional, dom, events, loop } from "../src/reactions.js";
import { catalystWarnings, getStore, setStoreState, settle } from "./utils.js";

describe("if reaction", () => {
	it("renders its template while the value is truthy", async () => {
		document.body.innerHTML = `
			<div data-store="c" data-state--open="false" data-state--name="Ada">
				<div id="if" data-if="$open">
					<template>
						<p data-dom--text="$name"></p>
						<span>Second</span>
					</template>
					<p id="placeholder">Server-rendered</p>
				</div>
			</div>
		`;
		Catalyst.init({ reactions: [conditional, dom] });
		const rendered = () =>
			Array.from(
				document.querySelector("#if")?.children ?? [],
				(child) => child.localName,
			);
		// The placeholder is replaced on the first render.
		expect(rendered()).toEqual(["template"]);

		setStoreState("c", "open", true);
		await settle();
		expect(rendered()).toEqual(["template", "p", "span"]);
		expect(document.querySelector("#if p")?.textContent).toBe("Ada");

		setStoreState("c", "name", "Grace");
		await settle();
		expect(document.querySelector("#if p")?.textContent).toBe("Grace");

		setStoreState("c", "open", false);
		await settle();
		expect(rendered()).toEqual(["template"]);
	});

	it("disposes rendered listeners and stores, and renders fresh markup again", async () => {
		const calls: string[] = [];
		document.body.innerHTML = `
			<div data-store="outer" data-state--open="true">
				<div data-if="$open">
					<template>
						<div data-store="inner">
							<button data-events--click="@press">Press</button>
						</div>
					</template>
				</div>
			</div>
		`;
		const inner = defineStore({
			actions: () => ({ press: () => calls.push("press") }),
			init: () => () => calls.push("cleanup"),
		});
		Catalyst.init({ stores: { inner }, reactions: [conditional, events] });
		const first = document.querySelector("button");
		expect(getStore("inner")).toBeDefined();

		setStoreState("outer", "open", false);
		await settle();
		first?.click();
		expect(calls).toEqual(["cleanup"]);
		expect(getStore("inner")).toBeUndefined();

		setStoreState("outer", "open", true);
		await settle();
		const second = document.querySelector("button");
		expect(second).not.toBe(first);
		second?.click();
		expect(calls).toEqual(["cleanup", "press"]);
	});

	it("works inside loop items", async () => {
		document.body.innerHTML = `
			<ul data-store="list" data-loop="$items">
				<template>
					<li data-if="$item.done"><template><span data-dom--text="$item.title"></span></template></li>
				</template>
			</ul>
		`;
		const list = defineStore({
			state: {
				items: [
					{ title: "One", done: true },
					{ title: "Two", done: false },
				],
			},
		});
		Catalyst.init({ stores: { list }, reactions: [conditional, dom, loop] });
		const spans = () =>
			Array.from(document.querySelectorAll("span"), (span) => span.textContent);
		expect(spans()).toEqual(["One"]);

		getStore("list")?.setState((state) => {
			const second = (state.items as Array<{ done: boolean }>)[1];
			if (second) second.done = true;
		});
		await settle();
		expect(spans()).toEqual(["One", "Two"]);
	});

	it("warns without a template", () => {
		document.body.innerHTML = `
			<div data-store="c" data-state--open="true"><div data-if="$open"></div></div>
		`;
		Catalyst.init({ reactions: [conditional] });
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining("requires a direct template child"),
		);
	});
});
