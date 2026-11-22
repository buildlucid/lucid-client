import { describe, expect, it } from "vite-plus/test";
import { parseStateString } from "../src/helpers.js";
import Catalyst, { createSignal, storeModule } from "../src/index.js";
import { dom } from "../src/reactions.js";
import Runtime from "../src/runtime/catalyst.js";
import { catalystWarnings, settle } from "./utils.js";

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
		expect(Runtime.stores.get("s")?.state.zip?.[0]()).toBe("007");
	});

	it("keeps a state value's type when its attribute changes", async () => {
		document.body.innerHTML = `<div data-store="typed"></div>`;
		storeModule("typed", {
			state: () => ({
				label: createSignal("ready"),
				count: createSignal(1),
			}),
			setup: () => ({ actions: {} }),
		});
		document
			.querySelector("[data-store]")
			?.setAttribute("data-state--label", "ready");
		document
			.querySelector("[data-store]")
			?.setAttribute("data-state--count", "1");
		Catalyst.start();

		const root = document.querySelector("[data-store]");
		root?.setAttribute("data-state--label", "42");
		root?.setAttribute("data-state--count", "7");
		await settle();

		const store = Runtime.stores.get("typed");
		expect(store?.state.label?.[0]()).toBe("42");
		expect(store?.state.count?.[0]()).toBe(7);
	});

	it("does not recreate a removed state attribute", async () => {
		document.body.innerHTML = `<div data-store="r" data-state--value="x"></div>`;
		Catalyst.start();
		const root = document.querySelector("[data-store]");
		root?.removeAttribute("data-state--value");
		await settle();

		expect(root?.hasAttribute("data-state--value")).toBe(false);
		expect(Runtime.stores.get("r")?.state.value?.[0]()).toBeNull();
	});

	it("maps kebab-case state attributes to camelCase keys", async () => {
		document.body.innerHTML = `
			<div data-store="profile" data-state--user-name="Ada">
				<span data-dom--text="$userName"></span>
			</div>
		`;
		storeModule("profile", {
			state: () => ({ userName: createSignal("Grace") }),
			setup: () => ({ actions: {} }),
		});
		Catalyst.start({ reactions: [dom] });
		await settle();

		const root = document.querySelector("[data-store]");
		const store = Runtime.stores.get("profile");
		expect(Object.keys(store?.state ?? {})).toEqual(["userName"]);
		expect(root?.getAttribute("data-state--user-name")).toBe("Grace");
		expect(document.querySelector("span")?.textContent).toBe("Grace");

		store?.state.userName?.[1]("Linus");
		await settle();
		expect(root?.getAttribute("data-state--user-name")).toBe("Linus");

		root?.setAttribute("data-state--user-name", "Margaret");
		await settle();
		expect(store?.state.userName?.[0]()).toBe("Margaret");
	});

	it("warns when a lowercased attribute cannot match camelCase state", () => {
		document.body.innerHTML = `<div data-store="case" data-state--userName="Ada"></div>`;
		storeModule("case", {
			state: () => ({ userName: createSignal("Grace") }),
			setup: () => ({ actions: {} }),
		});
		Catalyst.start();

		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('Use "data-state--user-name" instead.'),
		);
	});
});
