import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { bind, dom } from "../src/reactions.js";
import { getStore, setStoreState, settle } from "./utils.js";

describe("store state and refs", () => {
	it("keeps state attributes and bindings in sync in both directions", async () => {
		document.body.innerHTML = `
			<div data-store="state" data-state--items='[{"url":"/one"}]'>
				<a data-bind--href="$items[0].url"></a>
			</div>
		`;

		Catalyst.init({ reactions: [bind] });
		await settle();
		const root = document.querySelector('[data-store="state"]');
		const link = document.querySelector("a");
		expect(link?.getAttribute("href")).toBe("/one");

		setStoreState("state", "items", [{ url: "/two" }]);
		await settle();
		expect(root?.getAttribute("data-state--items")).toBe('[{"url":"/two"}]');
		expect(link?.getAttribute("href")).toBe("/two");

		root?.setAttribute("data-state--items", '[{"url":"/three"}]');
		await settle();
		expect(link?.getAttribute("href")).toBe("/three");
	});

	it("uses the nearest store while preserving explicit cross-store scopes", async () => {
		document.body.innerHTML = `
			<div data-store="outer" data-state--label="Outer">
				<span id="movable" data-dom--text="$label"></span>
				<div data-store="inner" data-state--label="Inner">
					<span id="inner" data-dom--text="$label"></span>
					<span id="cross-store" data-dom--text="outer:$label"></span>
				</div>
			</div>
		`;

		Catalyst.init({ reactions: [dom] });
		await settle();
		expect(document.querySelector("#movable")?.textContent).toBe("Outer");
		expect(document.querySelector("#inner")?.textContent).toBe("Inner");
		expect(document.querySelector("#cross-store")?.textContent).toBe("Outer");

		const inner = document.querySelector('[data-store="inner"]');
		const movable = document.querySelector("#movable");
		if (!(inner instanceof Element) || !(movable instanceof Element)) {
			throw new Error("Missing inferred-scope fixtures");
		}
		inner.append(movable);
		Catalyst.sync(inner);
		await settle();
		expect(movable.textContent).toBe("Inner");
	});

	it("registers refs before init, without registering a reaction", () => {
		document.body.innerHTML = `
			<div data-store="refs">
				<button data-ref="#button"></button>
				<input data-ref="#fields[]" />
				<input data-ref="#fields[]" />
				<div data-store="nested-refs">
					<span id="cross-ref" data-ref="refs:#cross"></span>
					<span id="nested-ref" data-ref="#nested"></span>
				</div>
			</div>
		`;

		let button: HTMLButtonElement | undefined;
		let cross: HTMLElement | undefined;
		let fields: HTMLInputElement[] = [];
		let firstField: HTMLInputElement | undefined;
		let missing: HTMLElement[] = [];
		const refs = defineStore({
			init: ({ refs }) => {
				button = refs.get<HTMLButtonElement>("button");
				cross = refs.get("cross");
				fields = refs.all<HTMLInputElement>("fields");
				firstField = refs.get<HTMLInputElement>("fields");
				missing = refs.all("missing");
			},
		});

		Catalyst.init({ stores: { refs } });
		const inputs = Array.from(document.querySelectorAll("input"));
		expect(button).toBe(document.querySelector("button"));
		expect(cross).toBe(document.querySelector("#cross-ref"));
		expect(fields).toEqual(inputs);
		expect(firstField).toBe(inputs[0]);
		expect(missing).toEqual([]);
		expect(getStore("nested-refs")?.refs.get("nested")).toBe(
			document.querySelector("#nested-ref"),
		);
	});
});
