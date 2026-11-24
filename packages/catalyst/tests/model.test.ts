import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { bind, loop, model } from "../src/reactions.js";
import { catalystWarnings, getStore, setStoreState, settle } from "./utils.js";

const type = (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
	field.value = value;
	field.dispatchEvent(new Event("input", { bubbles: true }));
};

const change = (field: HTMLElement) =>
	field.dispatchEvent(new Event("change", { bubbles: true }));

const field = <E extends Element = HTMLInputElement>(selector: string) => {
	const element = document.querySelector<E>(selector);
	if (!element) throw new Error(`Missing ${selector}`);
	return element;
};

describe("model reaction", () => {
	it("keeps text fields and state in sync both ways", async () => {
		document.body.innerHTML = `
			<form data-store="profile">
				<input id="name" data-model="$name" />
				<textarea id="bio" data-model="$details.bio"></textarea>
			</form>
		`;
		const profile = defineStore({
			state: { name: "Ada", details: { bio: "" } },
		});
		Catalyst.init({ stores: { profile }, reactions: [model] });
		expect(field("#name").value).toBe("Ada");

		type(field("#name"), "Grace");
		type(field<HTMLTextAreaElement>("#bio"), "Compilers");
		await settle();
		expect(getStore("profile")?.state.name).toBe("Grace");
		expect(getStore("profile")?.state.details).toEqual({ bio: "Compilers" });

		setStoreState("profile", "name", "Hopper");
		await settle();
		expect(field("#name").value).toBe("Hopper");
	});

	it("rewrites a field when state is set back to a value it held", async () => {
		document.body.innerHTML = `
			<div data-store="fruit">
				<input data-model="$value" />
				<button data-reset></button>
			</div>
		`;
		const fruit = defineStore({ state: { value: "apple" } });
		Catalyst.init({ stores: { fruit }, reactions: [model] });

		type(field("input"), "typed by user");
		await settle();
		setStoreState("fruit", "value", "apple");
		await settle();
		expect(field("input").value).toBe("apple");
	});

	it("types number fields, checkboxes, radios and selects", async () => {
		document.body.innerHTML = `
			<form data-store="prefs">
				<input id="seats" type="number" data-model="$seats" />
				<input id="news" type="checkbox" data-model="$newsletter" />
				<input id="free" type="radio" name="plan" value="free" data-model="$plan" />
				<input id="pro" type="radio" name="plan" value="pro" data-model="$plan" />
				<input id="design" type="checkbox" value="design" data-model="$topics" />
				<input id="docs" type="checkbox" value="docs" data-model="$topics" />
				<select id="size" data-model="$size">
					<option value="1">S</option><option value="2">M</option>
				</select>
				<select id="tags" multiple data-model="$tags">
					<option value="a"></option><option value="b"></option><option value="c"></option>
				</select>
			</form>
		`;
		const prefs = defineStore({
			state: {
				seats: 2 as number | null,
				newsletter: false,
				plan: "pro",
				topics: ["docs"] as string[],
				size: 1,
				tags: ["b"] as string[],
			},
		});
		Catalyst.init({ stores: { prefs }, reactions: [model] });
		const state = () => getStore("prefs")?.state;
		const selected = (select: HTMLSelectElement) =>
			Array.from(select.options)
				.filter((option) => option.selected)
				.map((option) => option.value);

		expect(field("#seats").value).toBe("2");
		expect(field("#pro").checked).toBe(true);
		expect(field("#docs").checked).toBe(true);
		expect(field<HTMLSelectElement>("#size").value).toBe("1");
		expect(selected(field<HTMLSelectElement>("#tags"))).toEqual(["b"]);

		type(field("#seats"), "");
		field("#news").click();
		field("#free").click();
		field("#design").click();
		field("#docs").click();
		field<HTMLSelectElement>("#size").value = "2";
		change(field("#size"));
		const tags = field<HTMLSelectElement>("#tags");
		for (const option of Array.from(tags.options)) {
			option.selected = option.value !== "b";
		}
		change(tags);
		await settle();

		expect(state()?.seats).toBeNull();
		expect(state()?.newsletter).toBe(true);
		expect(state()?.plan).toBe("free");
		expect(state()?.topics).toEqual(["design"]);
		expect(state()?.size).toBe(2);
		expect(state()?.tags).toEqual(["a", "c"]);

		setStoreState("prefs", "newsletter", false);
		setStoreState("prefs", "plan", "pro");
		await settle();
		expect(field("#news").checked).toBe(false);
		expect(field("#pro").checked).toBe(true);
		expect(field("#free").checked).toBe(false);
	});

	it("writes a property of a loop item to the store the loop renders", async () => {
		document.body.innerHTML = `
			<div data-store="invoice">
				<ul data-loop="$lines">
					<template><li><input data-model="$item.qty" type="number" /></li></template>
				</ul>
			</div>
		`;
		const invoice = defineStore({
			state: { lines: [{ qty: 1 }, { qty: 2 }] },
		});
		Catalyst.init({ stores: { invoice }, reactions: [loop, model] });

		const inputs = document.querySelectorAll("input");
		const second = inputs[1];
		if (!second) throw new Error("Missing input");
		type(second, "7");
		await settle();
		expect(getStore("invoice")?.state.lines).toEqual([{ qty: 1 }, { qty: 7 }]);
		// The row was updated in place, not rendered again.
		expect(document.querySelectorAll("input")[1]).toBe(second);
	});

	it("follows a native form reset", async () => {
		document.body.innerHTML = `
			<form data-store="report">
				<input id="title" value="Quarterly report" data-model="$title" />
				<input id="a" type="checkbox" value="a" checked data-model="$flags" />
				<input id="b" type="checkbox" value="b" data-model="$flags" />
			</form>
		`;
		const report = defineStore({
			state: { title: "Quarterly report", flags: ["a"] as string[] },
		});
		Catalyst.init({ stores: { report }, reactions: [model] });

		type(field("#title"), "Edited");
		field("#a").click();
		field("#b").click();
		await settle();
		expect(getStore("report")?.state.flags).toEqual(["b"]);

		field<HTMLFormElement>("form").reset();
		await settle();
		expect(getStore("report")?.state.title).toBe("Quarterly report");
		expect(getStore("report")?.state.flags).toEqual(["a"]);
	});

	it("clears a radio group's state when a reset leaves none chosen", async () => {
		document.body.innerHTML = `
			<form data-store="plans">
				<input id="free" type="radio" name="plan" value="free" data-model="$plan" />
				<input id="pro" type="radio" name="plan" value="pro" data-model="$plan" />
				<input id="size-s" type="radio" name="size" value="s" checked data-model="$size" />
				<input id="size-m" type="radio" name="size" value="m" data-model="$size" />
			</form>
		`;
		const plans = defineStore({ state: { plan: "pro", size: "m" } });
		Catalyst.init({ stores: { plans }, reactions: [model] });
		expect(field("#pro").checked).toBe(true);
		expect(field("#size-m").checked).toBe(true);

		field<HTMLFormElement>("form").reset();
		await settle();
		// No plan radio has a default, so none is chosen; size returns to "s".
		expect(getStore("plans")?.state.plan).toBeNull();
		expect(getStore("plans")?.state.size).toBe("s");
	});

	it("keeps checkbox groups of different stores apart", async () => {
		document.body.innerHTML = `
			<div data-store="first">
				<input id="first-a" type="checkbox" value="a" data-model="$picked" />
			</div>
			<div data-store="second">
				<input id="second-a" type="checkbox" value="a" data-model="$picked" />
				<input id="second-b" type="checkbox" value="b" data-model="$picked" />
			</div>
		`;
		const picker = defineStore({ state: { picked: ["kept"] as string[] } });
		Catalyst.init({
			stores: { first: picker, second: picker },
			reactions: [model],
		});

		field("#first-a").click();
		field("#second-b").click();
		await settle();
		expect(getStore("first")?.state.picked).toEqual(["kept", "a"]);
		expect(getStore("second")?.state.picked).toEqual(["kept", "b"]);
	});

	it("warns about fields and references it can't bind", async () => {
		document.body.innerHTML = `
			<div data-store="bad">
				<div data-model="$label"></div>
				<input id="computed" data-model="$upper" />
				<input data-model="@action" />
				<ul data-loop="$items">
					<template><li><input data-model="$item" /></li></template>
				</ul>
			</div>
		`;
		const bad = defineStore({
			state: { label: "a", items: ["x"] },
			computed: ({ state }) => ({ upper: () => state.label.toUpperCase() }),
			actions: () => ({ action: () => "value" }),
		});
		Catalyst.init({ stores: { bad }, reactions: [bind, loop, model] });
		type(field("#computed"), "B");
		await settle();

		const warnings = catalystWarnings();
		expect(warnings).toContainEqual(
			expect.stringContaining(
				"requires an input, select, textarea, dialog, details or popover",
			),
		);
		expect(
			warnings.filter((warning) => warning.includes("requires state")),
		).toHaveLength(2);
		expect(warnings).toContainEqual(
			expect.stringContaining('"upper" isn\'t declared state'),
		);
		expect(getStore("bad")?.state.label).toBe("a");
	});
});

describe("model modifiers", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("writes on change with lazy, and trims without moving the cursor's text", async () => {
		document.body.innerHTML = `
			<div data-store="m" data-state--lazy="" data-state--name="">
				<input id="lazy" data-model--lazy="$lazy" />
				<input id="name" data-model--trim="$name" />
			</div>
		`;
		Catalyst.init({ reactions: [model] });

		type(field("#lazy"), "typed");
		await settle();
		expect(getStore("m")?.state.lazy).toBe("");
		change(field("#lazy"));
		expect(getStore("m")?.state.lazy).toBe("typed");

		const name = field("#name");
		type(name, " Ada ");
		await settle();
		expect(getStore("m")?.state.name).toBe("Ada");
		// The field keeps what was typed until it changes.
		expect(name.value).toBe(" Ada ");
		change(name);
		expect(name.value).toBe("Ada");
	});

	it("waits for typing to pause with debounce, and writes straight away on change", async () => {
		vi.useFakeTimers();
		document.body.innerHTML = `
			<div data-store="m" data-state--query="">
				<input data-model--debounce.300ms="$query" />
			</div>
		`;
		Catalyst.init({ reactions: [model] });
		const input = field("input");

		type(input, "a");
		type(input, "ab");
		vi.advanceTimersByTime(299);
		expect(getStore("m")?.state.query).toBe("");
		vi.advanceTimersByTime(1);
		expect(getStore("m")?.state.query).toBe("ab");

		type(input, "abc");
		change(input);
		expect(getStore("m")?.state.query).toBe("abc");

		// A value set without an input event, such as by autofill.
		input.value = "autofilled";
		change(input);
		expect(getStore("m")?.state.query).toBe("autofilled");
	});
});

describe("debounced models in forms", () => {
	it("writes a waiting edit before the form's submit listeners run", () => {
		document.body.innerHTML = `
			<form data-store="m" data-state--query="">
				<input data-model--debounce="$query" />
			</form>
		`;
		Catalyst.init({ reactions: [model] });
		const form = field<HTMLFormElement>("form");
		let submitted: unknown;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			submitted = getStore("m")?.state.query;
		});
		type(field("input"), "new query");
		form.requestSubmit();
		expect(submitted).toBe("new query");
	});
});

describe("model toggles", () => {
	it("opens a dialog as a modal and writes false when it closes", async () => {
		document.body.innerHTML = `
			<div data-store="d" data-state--open="false">
				<dialog data-model="$open"><button>Close</button></dialog>
			</div>
		`;
		Catalyst.init({ reactions: [model] });
		const dialog = field<HTMLDialogElement>("dialog");
		expect(dialog.open).toBe(false);

		setStoreState("d", "open", true);
		await settle();
		expect(dialog.open).toBe(true);

		// Closed by the browser, as `Escape` or a form with method="dialog" do.
		dialog.close();
		await settle();
		expect(getStore("d")?.state.open).toBe(false);
	});

	it("keeps a details element's open state in sync both ways", async () => {
		document.body.innerHTML = `
			<div data-store="d" data-state--open="true">
				<details data-model="$open"><summary>More</summary></details>
			</div>
		`;
		Catalyst.init({ reactions: [model] });
		const details = field<HTMLDetailsElement>("details");
		expect(details.open).toBe(true);

		details.open = false;
		details.dispatchEvent(new Event("toggle"));
		expect(getStore("d")?.state.open).toBe(false);

		setStoreState("d", "open", true);
		await settle();
		expect(details.open).toBe(true);
	});
});

describe("model toggle edge cases", () => {
	it("opens a dialog the markup rendered open as a modal, and closes it when destroyed", async () => {
		document.body.innerHTML = `
			<div data-store="d" data-state--open="true">
				<dialog open data-model="$open"></dialog>
			</div>
		`;
		// happy-dom doesn't match `:modal`, so showModal is watched instead.
		const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
		Catalyst.init({ reactions: [model] });
		await settle();
		const dialog = field<HTMLDialogElement>("dialog");
		expect(showModal).toHaveBeenCalledTimes(1);
		expect(dialog.open).toBe(true);

		Catalyst.destroy();
		expect(dialog.open).toBe(false);
	});
});
