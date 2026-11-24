import { describe, expect, it } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { bind, trap } from "../src/reactions.js";
import { setStoreState, settle } from "./utils.js";

const setState = async (store: string, key: string, value: unknown) => {
	setStoreState(store, key, value);
	await settle();
};

const isInert = (selector: string) =>
	document.querySelector(selector)?.hasAttribute("inert") ?? false;

describe("trap reaction", () => {
	it("makes content outside a nested trap inert at every level", async () => {
		document.body.innerHTML = `
			<main id="main">
				<p id="intro">Intro</p>
				<div data-store="dialog" data-state--open="false">
					<button id="trigger">Open</button>
					<div id="dialog" data-trap="$open"><button id="inside">Close</button></div>
				</div>
			</main>
			<footer id="footer"></footer>
		`;
		Catalyst.init({ reactions: [trap] });
		const trigger = document.querySelector<HTMLElement>("#trigger");
		trigger?.focus();

		await setState("dialog", "open", true);
		expect(isInert("#trigger")).toBe(true);
		expect(isInert("#intro")).toBe(true);
		expect(isInert("#footer")).toBe(true);
		expect(isInert("#main")).toBe(false);
		expect(isInert("#dialog")).toBe(false);
		expect(document.activeElement?.id).toBe("inside");
		expect(document.body.style.overflow).toBe("hidden");

		await setState("dialog", "open", false);
		expect(isInert("#trigger")).toBe(false);
		expect(isInert("#intro")).toBe(false);
		expect(isInert("#footer")).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("moves focus after the binding that shows the trap has run", async () => {
		document.body.innerHTML = `
			<div data-store="shown">
				<button id="opener">Open</button>
				<div id="dialog" data-trap="$open" data-bind--hidden="$closed" hidden>
					<button id="inside">Close</button>
				</div>
			</div>
		`;
		const shown = defineStore({
			state: { open: false },
			computed: ({ state }) => ({ closed: () => !state.open }),
		});
		Catalyst.init({ stores: { shown }, reactions: [trap, bind] });
		document.querySelector<HTMLElement>("#opener")?.focus();

		// Records whether the dialog was still hidden when focus arrived.
		const hiddenWhenFocused: boolean[] = [];
		const dialog = document.querySelector("#dialog");
		dialog?.addEventListener("focusin", () => {
			hiddenWhenFocused.push(dialog.hasAttribute("hidden"));
		});

		await setState("shown", "open", true);
		expect(hiddenWhenFocused).toEqual([false]);
		expect(document.activeElement?.id).toBe("inside");
	});

	it("restores only the inert state it changed", async () => {
		document.body.style.overflow = "scroll";
		document.body.innerHTML = `
			<div id="already" inert></div>
			<div data-store="t" data-state--open="false">
				<div id="dialog" data-trap="$open"></div>
			</div>
		`;
		Catalyst.init({ reactions: [trap] });
		await setState("t", "open", true);
		await setState("t", "open", false);

		expect(isInert("#already")).toBe(true);
		expect(document.body.style.overflow).toBe("scroll");
		expect(document.querySelector("#dialog")?.hasAttribute("tabindex")).toBe(
			false,
		);
	});

	it("keeps the outer trap intact when a stacked trap closes", async () => {
		document.body.innerHTML = `
			<div id="page"><button id="start">Start</button></div>
			<div data-store="t" data-state--outer="false" data-state--inner="false">
				<div id="outer" data-trap="$outer"><button id="outer-button">Next</button></div>
				<div id="inner" data-trap="$inner"><button id="inner-button">Done</button></div>
			</div>
		`;
		Catalyst.init({ reactions: [trap] });

		await setState("t", "outer", true);
		expect(isInert("#page")).toBe(true);
		expect(isInert("#inner")).toBe(true);
		expect(document.activeElement?.id).toBe("outer-button");

		await setState("t", "inner", true);
		expect(isInert("#outer")).toBe(true);
		expect(isInert("#inner")).toBe(false);
		expect(document.activeElement?.id).toBe("inner-button");

		await setState("t", "inner", false);
		expect(isInert("#page")).toBe(true);
		expect(isInert("#outer")).toBe(false);
		expect(document.activeElement?.id).toBe("outer-button");

		await setState("t", "outer", false);
		expect(isInert("#page")).toBe(false);
		expect(isInert("#inner")).toBe(false);
	});

	it("leaves elements marked data-trap-allow interactive", async () => {
		document.body.innerHTML = `
			<header data-store="nav" data-state--open="false">
				<div id="bar">
					<span id="logo">Logo</span>
					<button id="toggle" data-trap-allow>Menu</button>
				</div>
				<nav id="menu" data-trap--both="$open"><a href="/">Home</a></nav>
			</header>
		`;
		Catalyst.init({ reactions: [trap] });
		expect(isInert("#menu")).toBe(true);

		await setState("nav", "open", true);
		expect(isInert("#menu")).toBe(false);
		expect(isInert("#toggle")).toBe(false);
		expect(isInert("#bar")).toBe(false);
		expect(isInert("#logo")).toBe(true);

		await setState("nav", "open", false);
		expect(isInert("#menu")).toBe(true);
		expect(isInert("#logo")).toBe(false);
	});
});
