import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { css, loop } from "../src/reactions.js";
import { catalystWarnings, setStoreState, settle } from "./utils.js";

const property = (selector: string, name: string) =>
	document.querySelector<HTMLElement>(selector)?.style.getPropertyValue(name);

describe("css reaction", () => {
	it("sets a custom property from state and keeps it up to date", async () => {
		document.body.innerHTML = `
			<div data-store="player" data-state--progress="30" data-css--progress="$progress"></div>
		`;
		Catalyst.start({ reactions: [css] });
		expect(property("[data-store]", "--progress")).toBe("30");

		setStoreState("player", "progress", 75);
		await settle();
		expect(property("[data-store]", "--progress")).toBe("75");
		// The style attribute it writes isn't mistaken for state.
		expect(
			document
				.querySelector("[data-store]")
				?.getAttribute("data-state--progress"),
		).toBe("75");
	});

	it("writes text, and removes the property for nullish and empty values", async () => {
		const values = defineStore({ state: { value: "red" as unknown } });
		document.body.innerHTML = `
			<div data-store="values"><div data-css--value="$value"></div></div>
		`;
		Catalyst.start({ stores: { values }, reactions: [css] });

		const cases: Array<[unknown, string]> = [
			["red", "red"],
			[0, "0"],
			[12.5, "12.5"],
			[true, "true"],
			[false, "false"],
			[null, ""],
			["1rem", "1rem"],
			[undefined, ""],
			["blue", "blue"],
			["", ""],
		];
		for (const [value, expected] of cases) {
			setStoreState("values", "value", value);
			await settle();
			expect(property("[data-css--value]", "--value")).toBe(expected);
		}
		expect(catalystWarnings()).toEqual([]);
	});

	it("warns about objects and arrays and removes the property", async () => {
		const values = defineStore({ state: { value: "red" as unknown } });
		document.body.innerHTML = `
			<div data-store="values"><div data-css--value="$value"></div></div>
		`;
		Catalyst.start({ stores: { values }, reactions: [css] });

		setStoreState("values", "value", { color: "red" });
		await settle();
		expect(property("[data-css--value]", "--value")).toBe("");

		setStoreState("values", "value", "red");
		await settle();
		setStoreState("values", "value", ["red"]);
		await settle();
		expect(property("[data-css--value]", "--value")).toBe("");
		expect(catalystWarnings()).toEqual([
			'[Catalyst] The "data-css--value" directive must resolve to a string, number or boolean.',
			'[Catalyst] The "data-css--value" directive must resolve to a string, number or boolean.',
		]);
	});

	it("reads computed values and actions, including async actions", async () => {
		const theme = defineStore({
			state: { hue: 200 },
			computed: ({ state }) => ({
				accent: () => `oklch(0.7 0.1 ${state.hue})`,
			}),
			actions: ({ state }) => ({
				turn: () => state.hue / 360,
				later: async () => "1rem",
			}),
		});
		document.body.innerHTML = `
			<div data-store="theme">
				<div
					data-css--accent="$accent"
					data-css--turn="@turn"
					data-css--gap="@later"
				></div>
			</div>
		`;
		Catalyst.start({ stores: { theme }, reactions: [css] });
		expect(property("[data-css--accent]", "--accent")).toBe(
			"oklch(0.7 0.1 200)",
		);
		expect(property("[data-css--accent]", "--turn")).toBe(String(200 / 360));

		await settle();
		expect(property("[data-css--accent]", "--gap")).toBe("1rem");

		setStoreState("theme", "hue", 90);
		await settle();
		expect(property("[data-css--accent]", "--accent")).toBe(
			"oklch(0.7 0.1 90)",
		);
		expect(property("[data-css--accent]", "--turn")).toBe("0.25");
	});

	it("sets loop values, and updates them as items move", async () => {
		const list = defineStore({ state: { items: ["a", "b", "c"] } });
		document.body.innerHTML = `
			<div data-store="list">
				<ul data-loop="$items">
					<template><li data-css--index="$index"></li></template>
				</ul>
			</div>
		`;
		Catalyst.start({ stores: { list }, reactions: [css, loop] });
		const indexes = () =>
			Array.from(document.querySelectorAll("li"), (item) =>
				item.style.getPropertyValue("--index"),
			);
		expect(indexes()).toEqual(["0", "1", "2"]);

		setStoreState("list", "items", ["c", "a"]);
		await settle();
		expect(indexes()).toEqual(["0", "1"]);
		expect(
			document.querySelector("li")?.style.getPropertyValue("--index"),
		).toBe("0");
	});

	it("sets custom properties on SVG elements", () => {
		document.body.innerHTML = `
			<div data-store="icon" data-state--color="tomato">
				<svg data-css--color="$color"></svg>
			</div>
		`;
		Catalyst.start({ reactions: [css] });
		expect(
			document.querySelector("svg")?.style.getPropertyValue("--color"),
		).toBe("tomato");
	});

	it("keeps other inline styles and restores the earlier value when disposed", async () => {
		document.body.innerHTML = `
			<div data-store="restore" data-state--size="2rem">
				<div id="rendered" style="color: red; --size: 1rem !important" data-css--size="$size"></div>
				<div id="added" data-css--size="$size"></div>
			</div>
		`;
		Catalyst.start({ reactions: [css] });
		const rendered = document.querySelector<HTMLElement>("#rendered");
		expect(rendered?.style.getPropertyValue("--size")).toBe("2rem");
		expect(rendered?.style.getPropertyValue("color")).toBe("red");
		expect(property("#added", "--size")).toBe("2rem");

		Catalyst.refresh("restore");
		expect(rendered?.style.getPropertyValue("--size")).toBe("2rem");

		rendered?.removeAttribute("data-css--size");
		document.querySelector("#added")?.removeAttribute("data-css--size");
		Catalyst.sync(document.body);
		expect(rendered?.style.getPropertyValue("--size")).toBe("1rem");
		expect(rendered?.style.getPropertyPriority("--size")).toBe("important");
		expect(rendered?.style.getPropertyValue("color")).toBe("red");
		expect(property("#added", "--size")).toBe("");

		setStoreState("restore", "size", "3rem");
		await settle();
		expect(rendered?.style.getPropertyValue("--size")).toBe("1rem");
	});

	it("warns about misconfigured directives and leaves the element alone", () => {
		document.body.innerHTML = `
			<div data-store="broken" data-state--size="2rem">
				<div id="no-name" data-css="$size"></div>
				<div id="dotted" data-css--root.size="$size"></div>
				<div id="ref" data-css--size="#size"></div>
				<div id="literal" data-css--size="2rem"></div>
			</div>
		`;
		const foreign = document.createElementNS("urn:example", "thing");
		foreign.setAttribute("data-css--size", "$size");
		document.querySelector("[data-store]")?.append(foreign);
		Catalyst.start({ reactions: [css] });

		expect(catalystWarnings()).toEqual([
			"[Catalyst] CSS directives require a custom property name specifier.",
			`[Catalyst] The "data-css--root.size" directive's custom property name can't contain ".".`,
			'[Catalyst] The "data-css--size" directive requires state or an action.',
			'[Catalyst] The "data-css--size" directive requires a state or action reference.',
			'[Catalyst] The "data-css--size" directive requires an element with inline styles.',
		]);
		for (const element of document.querySelectorAll<HTMLElement>(
			"[data-store] > div",
		)) {
			expect(element.getAttribute("style")).toBeNull();
		}
	});

	it("is reported in debug mode when it isn't registered", () => {
		document.body.innerHTML = `
			<div data-store="unregistered" data-state--size="2rem">
				<div data-css--size="$size"></div>
			</div>
		`;
		Catalyst.start({ debug: true, reactions: [] });
		expect(catalystWarnings()).toContain(
			'[Catalyst] Found "data-css--size" but the css reaction isn\'t registered. Add css to Catalyst.start({ reactions }).',
		);
	});
});
