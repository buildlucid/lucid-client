import { describe, expect, it } from "vite-plus/test";
import Catalyst from "../src/index.js";
import { bind, dom } from "../src/reactions.js";
import Runtime from "../src/runtime/catalyst.js";
import { catalystWarnings, settle } from "./utils.js";

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
		Catalyst.start({ reactions: [bind] });
		const button = document.querySelector("button");

		expect(button?.hasAttribute("disabled")).toBe(false);
		expect(button?.getAttribute("hidden")).toBe("");
		expect(button?.hasAttribute("title")).toBe(false);
		expect(button?.getAttribute("aria-expanded")).toBe("false");
		expect(button?.getAttribute("data-open")).toBe("false");
		expect(button?.getAttribute("draggable")).toBe("false");

		Runtime.stores.get("b")?.state.off?.[1](true);
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
		Catalyst.start({ reactions: [bind] });
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
		Catalyst.start({ reactions: [dom] });
		expect(document.querySelector("span")?.textContent).toBe("");

		Runtime.stores.get("d")?.state.label?.[1]("Hello");
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
		Catalyst.start({ reactions: [dom] });
		expect(document.querySelector("[data-dom--htm]")?.textContent).toBe(
			"fallback",
		);
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining("unknown specifier"),
		);
	});
});
