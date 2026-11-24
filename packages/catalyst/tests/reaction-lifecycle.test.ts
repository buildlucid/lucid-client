import { describe, expect, it, vi } from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { bind, dom, events } from "../src/reactions.js";
import type { Reaction } from "../src/types/index.js";
import { catalystWarnings, setStoreState, settle } from "./utils.js";

describe("reaction lifecycle", () => {
	it("initialises dynamic bindings once and disposes removed events", async () => {
		document.body.innerHTML = `
			<div data-store="dynamic">
				<div id="target"></div>
			</div>
		`;

		let clicks = 0;
		const dynamic = defineStore({
			state: { label: "initial" },
			actions: () => ({
				select: () => {
					clicks += 1;
				},
			}),
		});

		Catalyst.init({ stores: { dynamic }, reactions: [bind, events] });
		const target = document.querySelector("#target");
		if (!(target instanceof HTMLElement)) throw new Error("Missing target");
		target.innerHTML = `
			<button
				data-bind--title="$label"
				data-events--click="@select"
			></button>
		`;
		Catalyst.sync(target);
		Catalyst.sync(target);
		await settle();

		const button = target.querySelector("button");
		expect(button?.getAttribute("title")).toBe("initial");
		button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(clicks).toBe(1);

		setStoreState("dynamic", "label", "updated");
		await settle();
		expect(button?.getAttribute("title")).toBe("updated");

		button?.remove();
		await settle();
		button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(clicks).toBe(1);
	});

	it("passes concrete directive data to custom reactions", () => {
		document.body.innerHTML = `
			<div data-store="scope">
				<div data-inspect--value="$key"></div>
			</div>
		`;
		const element = document.querySelector("[data-inspect--value]");
		const values: string[] = [];
		let cleanups = 0;
		const reaction: Reaction = {
			name: "inspect",
			attribute: "inspect",
			setup: (directive, context) => {
				expect(directive.element).toBe(element);
				expect(directive.reaction).toBe("inspect");
				expect(directive.attributeName).toBe("data-inspect--value");
				expect(directive.specifier).toBe("value");
				expect(context.getStore("scope")?.key).toBe("scope");
				if (directive.value === "$key") {
					expect(directive.reference).toMatchObject({
						type: "state",
						scope: "scope",
						key: "key",
					});
				} else {
					expect(directive.reference).toBeNull();
				}
				values.push(directive.value);
				return () => {
					cleanups += 1;
				};
			},
		};

		Catalyst.init({ reactions: [reaction] });
		expect(values).toEqual(["$key"]);

		element?.setAttribute("data-inspect--value", "is-active");
		if (element) Catalyst.sync(element);
		expect(values).toEqual(["$key", "is-active"]);
		expect(cleanups).toBe(1);
	});

	it("keeps inferred document actions distinct across stores", () => {
		document.body.innerHTML = `
			<div data-store="first">
				<div data-events--document.catalyst-test="@run"></div>
			</div>
			<div data-store="second">
				<div data-events--document.catalyst-test="@run"></div>
			</div>
		`;
		let firstRuns = 0;
		let secondRuns = 0;
		Catalyst.init({
			stores: {
				first: defineStore({
					actions: () => ({
						run: () => {
							firstRuns += 1;
						},
					}),
				}),
				second: defineStore({
					actions: () => ({
						run: () => {
							secondRuns += 1;
						},
					}),
				}),
			},
			reactions: [events],
		});

		document.dispatchEvent(new Event("catalyst-test"));
		expect(firstRuns).toBe(1);
		expect(secondRuns).toBe(1);
	});

	it("can be initialised again without registering reactions or stores again", async () => {
		const restartable = defineStore({ state: { label: "ready" } });
		document.body.innerHTML = `
			<div data-store="restartable">
				<span data-dom--text="$label"></span>
			</div>
		`;

		Catalyst.init({ stores: { restartable }, reactions: [dom] });
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("ready");
		setStoreState("restartable", "label", "changed");
		await settle();
		expect(document.querySelector("span")?.textContent).toBe("changed");
		Catalyst.destroy();

		document.body.innerHTML = `
			<div data-store="restartable">
				<span data-dom--text="$label"></span>
			</div>
		`;
		Catalyst.init();
		await settle();

		expect(document.querySelector("span")?.textContent).toBe("ready");
	});

	it("refuses attributes reserved for other Lucid Client packages", () => {
		document.body.innerHTML = `<div data-store="reserved"><button data-cookie--action="accept"></button></div>`;
		const setup = vi.fn();
		const cookie: Reaction = { name: "cookie", attribute: "cookie", setup };

		Catalyst.init({ reactions: [cookie] });

		expect(setup).not.toHaveBeenCalled();
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining(
				'The "cookie" attribute is reserved for another Lucid Client package.',
			),
		);
	});

	it("refuses the carousel attribute", () => {
		document.body.innerHTML = `<div data-store="reserved"></div>`;
		const setup = vi.fn();
		const carousel: Reaction = {
			name: "carousel",
			attribute: "carousel",
			setup,
		};

		Catalyst.init({ reactions: [carousel] });

		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining(
				'The "carousel" attribute is reserved for another Lucid Client package.',
			),
		);
	});

	it("refuses the form attribute", () => {
		document.body.innerHTML = `<div data-store="reserved"></div>`;
		const setup = vi.fn();
		const form: Reaction = { name: "form", attribute: "form", setup };

		Catalyst.init({ reactions: [form] });

		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining(
				'The "form" attribute is reserved for another Lucid Client package.',
			),
		);
	});

	it("warns when a different reaction reuses a registered name", () => {
		document.body.innerHTML = `<div data-store="names"></div>`;
		const impostor: Reaction = {
			name: "bind",
			attribute: "other-bind",
			setup: () => undefined,
		};

		Catalyst.init({ reactions: [bind, impostor] });

		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('A reaction named "bind" is already registered.'),
		);

		// Restarting with the reactions already registered doesn't warn.
		Catalyst.destroy();
		const before = catalystWarnings().length;
		Catalyst.init({ reactions: [bind] });
		expect(catalystWarnings()).toHaveLength(before);
	});
});
