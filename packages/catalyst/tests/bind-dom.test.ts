import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore, flush } from "../src/index.js";
import { bind, dom, loop } from "../src/reactions.js";
import Runtime from "../src/runtime/catalyst.js";
import { catalystWarnings, getStore, setStoreState, settle } from "./utils.js";

describe("bind reaction", () => {
	it("treats booleans and nullish values as attribute presence", async () => {
		document.body.innerHTML = `
			<div
				data-store="b"
				data-state--off="false"
				data-state--on="true"
				data-state--none="null"
			>
				<button
					data-bind--disabled="$off"
					data-bind--hidden="$on"
					data-bind--title="$none"
					data-bind--aria-expanded="$off"
					data-bind--data-open="$off"
					data-bind--draggable="$off"
				></button>
			</div>
		`;
		Catalyst.init({ reactions: [bind] });
		const button = document.querySelector("button");

		expect(button?.hasAttribute("disabled")).toBe(false);
		expect(button?.getAttribute("hidden")).toBe("");
		expect(button?.hasAttribute("title")).toBe(false);
		expect(button?.getAttribute("aria-expanded")).toBe("false");
		expect(button?.getAttribute("data-open")).toBe("false");
		expect(button?.getAttribute("draggable")).toBe("false");

		setStoreState("b", "off", true);
		await settle();
		expect(button?.getAttribute("disabled")).toBe("");
		expect(button?.getAttribute("aria-expanded")).toBe("true");
	});

	it("writes case-sensitive SVG attributes", () => {
		document.body.innerHTML = `
			<div data-store="svg" data-state--box="0 0 10 10">
				<svg data-bind--viewBox="$box"></svg>
			</div>
		`;
		Catalyst.init({ reactions: [bind] });
		expect(document.querySelector("svg")?.getAttribute("viewBox")).toBe(
			"0 0 10 10",
		);
	});
});

describe("dom reaction", () => {
	it("renders nullish text as empty, including on SVG elements", async () => {
		document.body.innerHTML = `
			<div data-store="d" data-state--label="null">
				<span data-dom--text="$label"></span>
				<svg><text data-dom--text="$label"></text></svg>
			</div>
		`;
		Catalyst.init({ reactions: [dom] });
		expect(document.querySelector("span")?.textContent).toBe("");

		setStoreState("d", "label", "Hello");
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("Hello");
		expect(document.querySelector("text")?.textContent).toBe("Hello");
	});

	it("warns about unknown specifiers instead of writing text", () => {
		document.body.innerHTML = `
			<div data-store="typo" data-state--content="<b>bold</b>">
				<div data-dom--htm="$content">fallback</div>
			</div>
		`;
		Catalyst.init({ reactions: [dom] });
		expect(document.querySelector("[data-dom--htm]")?.textContent).toBe(
			"fallback",
		);
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining("unknown specifier"),
		);
	});

	it("sets the checked property, including after the field was clicked", async () => {
		document.body.innerHTML = `
			<div data-store="choices" data-state--newsletter="false">
				<input type="checkbox" data-dom--checked="$newsletter" />
			</div>
		`;
		Catalyst.init({ reactions: [dom] });
		const box = document.querySelector<HTMLInputElement>("input");
		if (!box) throw new Error("Missing checkbox");
		expect(box.checked).toBe(false);

		box.click();
		expect(box.checked).toBe(true);
		setStoreState("choices", "newsletter", true);
		await settle();
		setStoreState("choices", "newsletter", false);
		await settle();
		expect(box.checked).toBe(false);
		expect(box.hasAttribute("checked")).toBe(false);
	});

	it("selects every option of a multiple select from an array", async () => {
		document.body.innerHTML = `
			<div data-store="interests">
				<select multiple data-dom--value="$picked">
					<option value="design"></option>
					<option value="docs"></option>
					<option value="support"></option>
				</select>
			</div>
		`;
		const interests = defineStore({ state: { picked: ["docs"] as string[] } });
		Catalyst.init({ stores: { interests }, reactions: [dom] });
		// happy-dom's selectedOptions goes stale, so read each option instead.
		const selected = () =>
			Array.from(document.querySelector("select")?.options ?? [])
				.filter((option) => option.selected)
				.map((option) => option.value);
		expect(selected()).toEqual(["docs"]);

		setStoreState("interests", "picked", ["design", "support"]);
		await settle();
		expect(selected()).toEqual(["design", "support"]);
	});

	it("selects a value whose option a loop renders afterwards", async () => {
		document.body.innerHTML = `
			<div data-store="address">
				<select data-loop="$regions" data-dom--value="$region">
					<template><option data-bind--value="$item" data-dom--text="$item"></option></template>
				</select>
			</div>
		`;
		const address = defineStore({
			state: { country: "uk", region: "wales" },
			computed: ({ state }) => ({
				regions: () =>
					state.country === "uk" ? ["england", "wales"] : ["ca", "ny", "tx"],
			}),
			actions: ({ setState }) => ({
				pickTexas: () =>
					setState((state) => {
						state.country = "us";
						state.region = "tx";
					}),
			}),
		});
		Catalyst.init({ stores: { address }, reactions: [bind, dom, loop] });
		const select = document.querySelector("select");
		await settle();
		expect(select?.value).toBe("wales");

		// The country and region change together, so the region is set before
		// the loop renders the new options.
		getStore("address")?.actions.pickTexas?.();
		await settle();
		expect(select?.value).toBe("tx");
	});
});

describe("server-rendered markup", () => {
	it("isn't written again when it already matches state", async () => {
		document.body.innerHTML = `
			<div data-store="card" data-state--likes="3">
				<button aria-expanded="false" data-bind--aria-expanded="$open">Card</button>
				<p hidden data-bind--hidden="$closed">Details</p>
				<span data-dom--text="$likes">3</span>
			</div>
		`;
		const card = defineStore({
			state: { open: false, likes: 0 },
			computed: ({ state }) => ({ closed: () => !state.open }),
		});
		const records: MutationRecord[] = [];
		const observer = new MutationObserver((items) => records.push(...items));
		observer.observe(document.body, {
			attributes: true,
			characterData: true,
			childList: true,
			subtree: true,
		});

		Catalyst.init({ stores: { card }, reactions: [bind, dom] });
		await settle();
		records.push(...observer.takeRecords());
		observer.disconnect();

		expect(records).toEqual([]);

		setStoreState("card", "likes", 4);
		setStoreState("card", "open", true);
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("4");
		expect(document.querySelector("p")?.hasAttribute("hidden")).toBe(false);
		expect(
			document.querySelector("button")?.getAttribute("aria-expanded"),
		).toBe("true");
	});
});

describe("unchanged values", () => {
	it("aren't written again when the state a binding reads changes", async () => {
		document.body.innerHTML = `
			<div data-store="badge">
				<p data-dom--html="@markup"></p>
			</div>
		`;
		const badge = defineStore({
			state: { count: 1 },
			actions: ({ state }) => ({
				markup: () => (state.count > 0 ? "<b>Active</b>" : ""),
			}),
		});
		Catalyst.init({ stores: { badge }, reactions: [dom] });
		const paragraph = document.querySelector("p") as HTMLParagraphElement;
		const bold = paragraph.firstElementChild;

		setStoreState("badge", "count", 2);
		await settle();

		expect(paragraph.firstElementChild).toBe(bold);
	});
});

describe("removed loop items", () => {
	it("are disposed as before when other code sets them up again straight away", async () => {
		document.body.innerHTML = `
			<ul data-store="list" data-loop="$items">
				<template><li data-dom--text="$item"></li></template>
			</ul>
		`;
		const list = defineStore({ state: { items: ["a"] } });
		Catalyst.init({ stores: { list }, reactions: [dom, loop] });
		const item = document.querySelector("li") as HTMLLIElement;

		getStore("list")?.setState((state) => {
			state.items = [];
		});
		flush();
		expect(item.isConnected).toBe(false);
		expect(Runtime.registrations.has(item)).toBe(false);

		// Set up again while detached, before the removal observer runs.
		Catalyst.sync(item);
		expect(Runtime.registrations.has(item)).toBe(true);
		await settle();

		expect(Runtime.registrations.has(item)).toBe(false);
	});
});
