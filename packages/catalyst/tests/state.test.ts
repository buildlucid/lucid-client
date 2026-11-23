import { describe, expect, it } from "vite-plus/test";
import { parseStateString } from "../src/helpers.js";
import Catalyst, { defineStore } from "../src/index.js";
import { dom } from "../src/reactions.js";
import { catalystWarnings, getStore, setStoreState, settle } from "./utils.js";

describe("parseStateString", () => {
	it("infers lossless primitives and JSON", () => {
		expect(parseStateString("")).toBe("");
		expect(parseStateString("true")).toBe(true);
		expect(parseStateString("false")).toBe(false);
		expect(parseStateString("null")).toBeNull();
		expect(parseStateString("42")).toBe(42);
		expect(parseStateString("-1.5")).toBe(-1.5);
		expect(parseStateString('{"a":1}')).toEqual({ a: 1 });
		expect(parseStateString("[1,2]")).toEqual([1, 2]);
	});

	it("keeps numeric-looking text that would not round-trip", () => {
		for (const value of [
			"007",
			"1e3",
			"0x10",
			" ",
			"1.50",
			"12345678901234567890",
			"Infinity",
		]) {
			expect(parseStateString(value)).toBe(value);
		}
	});
});

describe("state attributes", () => {
	it("does not rewrite state attributes on start", async () => {
		document.body.innerHTML = `
			<div
				data-store="s"
				data-state--name=""
				data-state--zip="007"
				data-state--id="12345678901234567890"
			>
				<span data-dom--text="$name"></span>
			</div>
		`;
		Catalyst.start({ reactions: [dom] });
		await settle();

		const root = document.querySelector("[data-store]");
		expect(root?.getAttribute("data-state--name")).toBe("");
		expect(root?.getAttribute("data-state--zip")).toBe("007");
		expect(root?.getAttribute("data-state--id")).toBe("12345678901234567890");
		expect(document.querySelector("span")?.textContent).toBe("");
		expect(getStore("s")?.state.zip).toBe("007");
	});

	it("starts from the attribute value, parsed to the default's type", async () => {
		document.body.innerHTML = `
			<div
				data-store="seeded"
				data-state--user-name="Ada"
				data-state--count="5"
				data-state--code="42"
			>
				<span data-dom--text="$userName"></span>
			</div>
		`;
		const seeded = defineStore({
			state: { userName: "Grace", count: 0, code: "", untouched: true },
		});
		Catalyst.start({ stores: { seeded }, reactions: [dom] });
		await settle();

		const root = document.querySelector("[data-store]");
		const state = getStore("seeded")?.state;
		expect(state?.userName).toBe("Ada");
		expect(state?.count).toBe(5);
		expect(state?.code).toBe("42");
		expect(state?.untouched).toBe(true);
		expect(root?.getAttribute("data-state--user-name")).toBe("Ada");
		expect(root?.hasAttribute("data-state--untouched")).toBe(false);
		expect(document.querySelector("span")?.textContent).toBe("Ada");
	});

	it("keeps a state value's type when its attribute changes", async () => {
		document.body.innerHTML = `
			<div data-store="typed" data-state--label="ready" data-state--count="1"></div>
		`;
		const typed = defineStore({ state: { label: "ready", count: 1 } });
		Catalyst.start({ stores: { typed } });

		const root = document.querySelector("[data-store]");
		root?.setAttribute("data-state--label", "42");
		root?.setAttribute("data-state--count", "7");
		await settle();

		const state = getStore("typed")?.state;
		expect(state?.label).toBe("42");
		expect(state?.count).toBe(7);
	});

	it("does not recreate a removed state attribute", async () => {
		document.body.innerHTML = `<div data-store="r" data-state--value="x"></div>`;
		Catalyst.start();
		const root = document.querySelector("[data-store]");
		root?.removeAttribute("data-state--value");
		await settle();

		expect(root?.hasAttribute("data-state--value")).toBe(false);
		expect(getStore("r")?.state.value).toBeNull();
	});

	it("maps kebab-case state attributes to camelCase keys in both directions", async () => {
		document.body.innerHTML = `
			<div data-store="profile" data-state--user-name="Ada">
				<span data-dom--text="$userName"></span>
			</div>
		`;
		const profile = defineStore({ state: { userName: "Grace" } });
		Catalyst.start({ stores: { profile }, reactions: [dom] });
		await settle();

		const root = document.querySelector("[data-store]");
		expect(Object.keys(getStore("profile")?.state ?? {})).toEqual(["userName"]);

		setStoreState("profile", "userName", "Linus");
		await settle();
		expect(root?.getAttribute("data-state--user-name")).toBe("Linus");
		expect(document.querySelector("span")?.textContent).toBe("Linus");

		root?.setAttribute("data-state--user-name", "Margaret");
		await settle();
		expect(getStore("profile")?.state.userName).toBe("Margaret");
	});

	it("updates an attribute when nested state changes", async () => {
		document.body.innerHTML = `<div data-store="nested" data-state--tags='["a"]'></div>`;
		const nested = defineStore({ state: { tags: [] as string[] } });
		Catalyst.start({ stores: { nested } });

		getStore("nested")?.setState((state) => {
			(state.tags as string[]).push("b");
		});
		await settle();
		expect(
			document.querySelector("[data-store]")?.getAttribute("data-state--tags"),
		).toBe('["a","b"]');
	});

	it("picks up state attributes added after the store exists", async () => {
		document.body.innerHTML = `
			<div data-store="late">
				<span data-dom--text="$label"></span>
			</div>
		`;
		const late = defineStore({ state: { label: "default" } });
		Catalyst.start({ stores: { late }, reactions: [dom] });
		expect(document.querySelector("span")?.textContent).toBe("default");

		const root = document.querySelector("[data-store]");
		root?.setAttribute("data-state--label", "from markup");
		if (root) Catalyst.sync(root);
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("from markup");

		setStoreState("late", "label", "from state");
		await settle();
		expect(root?.getAttribute("data-state--label")).toBe("from state");
	});

	it("warns when a lowercased attribute cannot match camelCase state", () => {
		document.body.innerHTML = `<div data-store="case" data-state--userName="Ada"></div>`;
		const caseStore = defineStore({ state: { userName: "Grace" } });
		Catalyst.start({ stores: { case: caseStore } });

		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('Use "data-state--user-name" instead.'),
		);
	});
});
