import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import Catalyst, { defineStore, flush } from "../src/index.js";
import { bind, conditional, events, loop } from "../src/reactions.js";
import type { LoopItem } from "../src/types/index.js";
import { catalystWarnings, getStore, settle } from "./utils.js";

/** A store that counts calls of `hit` and remembers the events it received. */
const counter = () => {
	const received: Event[] = [];
	const definition = defineStore({
		state: { count: 0 },
		actions: ({ setState }) => ({
			hit: (event: Event) => {
				received.push(event);
				setState((state) => {
					state.count += 1;
				});
			},
		}),
	});
	return { definition, received };
};

const key = (target: EventTarget, name: string, init: KeyboardEventInit = {}) =>
	target.dispatchEvent(
		new KeyboardEvent("keydown", { key: name, bubbles: true, ...init }),
	);

const click = (target: Element | null, init: MouseEventInit = {}) => {
	const event = new MouseEvent("click", {
		bubbles: true,
		cancelable: true,
		...init,
	});
	target?.dispatchEvent(event);
	return event;
};

describe("event modifiers", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("prevents the default action and stops propagation", async () => {
		document.body.innerHTML = `
			<div data-store="c" id="outer" data-events--click="@hit">
				<a href="#" id="link" data-events--click.prevent.stop="@hit">Link</a>
			</div>
		`;
		const { definition, received } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });

		const event = click(document.querySelector("#link"));
		expect(event.defaultPrevented).toBe(true);
		// The outer listener never sees the stopped click.
		expect(received).toHaveLength(1);
		await settle();
	});

	it("runs once, and only for the element itself with self", async () => {
		document.body.innerHTML = `
			<div data-store="c">
				<button id="once" data-events--click.once="@hit">Once</button>
				<div id="self" data-events--click.self="@hit"><span id="child">Child</span></div>
			</div>
		`;
		const { definition, received } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });

		click(document.querySelector("#once"));
		click(document.querySelector("#once"));
		expect(received).toHaveLength(1);

		click(document.querySelector("#child"));
		expect(received).toHaveLength(1);
		click(document.querySelector("#self"));
		expect(received).toHaveLength(2);
		await settle();
	});

	it("filters keyboard events by key name and system keys", async () => {
		document.body.innerHTML = `
			<div
				data-store="c"
				data-events--document.keydown.escape="@hit"
				data-events--document.keydown.arrow-down="@hit"
				data-events--document.keydown.ctrl.k="@hit"
				data-events--document.keydown.space="@hit"
			></div>
		`;
		const { definition, received } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });

		key(document, "Enter");
		key(document, "k");
		expect(received).toHaveLength(0);
		key(document, "Escape");
		key(document, "ArrowDown");
		key(document, "k", { ctrlKey: true });
		key(document, " ");
		expect(received.map((event) => (event as KeyboardEvent).key)).toEqual([
			"Escape",
			"ArrowDown",
			"k",
			" ",
		]);
		await settle();
	});

	it("requires system keys on mouse events and warns about unknown modifiers", async () => {
		document.body.innerHTML = `
			<div data-store="c">
				<button id="shift" data-events--click.shift="@hit">Shift</button>
				<button id="typo" data-events--click.prevnt="@hit">Typo</button>
			</div>
		`;
		const { definition, received } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });

		click(document.querySelector("#shift"));
		expect(received).toHaveLength(0);
		click(document.querySelector("#shift"), { shiftKey: true });
		expect(received).toHaveLength(1);

		// The unknown modifier is ignored, so the listener still works.
		click(document.querySelector("#typo"));
		expect(received).toHaveLength(2);
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('unknown modifier "prevnt"'),
		);
		await settle();
	});

	it("debounces calls with the last event, and throttles them", async () => {
		vi.useFakeTimers();
		document.body.innerHTML = `
			<div data-store="c">
				<input id="search" data-events--input.debounce.300ms="@hit" />
				<div id="scroll" data-events--scroll.throttle="@hit"></div>
			</div>
		`;
		const { definition, received } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });
		const input = document.querySelector("#search");

		const first = new Event("input");
		const last = new Event("input");
		input?.dispatchEvent(first);
		vi.advanceTimersByTime(200);
		input?.dispatchEvent(last);
		vi.advanceTimersByTime(299);
		expect(received).toHaveLength(0);
		vi.advanceTimersByTime(1);
		expect(received).toEqual([last]);

		received.length = 0;
		const scroll = document.querySelector("#scroll");
		scroll?.dispatchEvent(new Event("scroll"));
		scroll?.dispatchEvent(new Event("scroll"));
		expect(received).toHaveLength(1);
		vi.advanceTimersByTime(250);
		scroll?.dispatchEvent(new Event("scroll"));
		expect(received).toHaveLength(2);
	});

	it("drops a waiting debounced call when its element is removed", async () => {
		vi.useFakeTimers();
		document.body.innerHTML = `
			<div data-store="c"><input data-events--input.debounce="@hit" /></div>
		`;
		const { definition, received } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });

		document.querySelector("input")?.dispatchEvent(new Event("input"));
		document.body.innerHTML = "";
		await vi.advanceTimersByTimeAsync(500);
		expect(received).toHaveLength(0);
	});

	it("listens for events outside the element", async () => {
		document.body.innerHTML = `
			<p id="page">Page</p>
			<div data-store="c" id="menu" data-events--outside.click="@hit">
				<button id="inside">Inside</button>
			</div>
		`;
		const { definition, received } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });

		click(document.querySelector("#inside"));
		click(document.querySelector("#menu"));
		expect(received).toHaveLength(0);
		click(document.querySelector("#page"));
		expect(received).toHaveLength(1);

		document.querySelector("#menu")?.remove();
		await settle();
		click(document.querySelector("#page"));
		expect(received).toHaveLength(1);
	});

	it("runs outside actions after the clicked element's own", async () => {
		document.body.innerHTML = `
			<div data-store="popup" data-state--open="true">
				<button id="toggle" data-events--click="@toggle">Popup</button>
				<div data-events--outside.click="@close"></div>
			</div>
		`;
		const popup = defineStore({
			state: { open: true },
			actions: ({ setState }) => ({
				toggle: () =>
					setState((state) => {
						state.open = !state.open;
					}),
				close: () =>
					setState((state) => {
						state.open = false;
					}),
			}),
		});
		Catalyst.start({ stores: { popup }, reactions: [events] });

		// The toggle closes the open popup, and the outside click keeps it closed
		// rather than the toggle opening it again afterwards.
		click(document.querySelector("#toggle"));
		await settle();
		expect(getStore("popup")?.state.open).toBe(false);
	});

	it("decides an outside event before the clicked element's action changes the page", async () => {
		// happy-dom has no browser stylesheet to hide [hidden] elements.
		document.body.innerHTML = `
			<style>[hidden] { display: none; }</style>
			<div data-store="popup">
				<button id="open" data-events--click="@open">Popup</button>
				<div id="panel" data-bind--hidden="$closed" data-events--outside.click="@close" hidden></div>
			</div>
		`;
		const popup = defineStore({
			state: { open: false },
			computed: ({ state }) => ({ closed: () => !state.open }),
			actions: ({ setState }) => ({
				// Browsers apply the change between listeners, as flush does here,
				// so the panel is shown before the click reaches document.
				open: () => {
					setState((state) => {
						state.open = true;
					});
					flush();
				},
				close: () =>
					setState((state) => {
						state.open = false;
					}),
			}),
		});
		Catalyst.start({ stores: { popup }, reactions: [bind, events] });

		click(document.querySelector("#open"));
		await settle();
		expect(document.querySelector("#panel")?.hasAttribute("hidden")).toBe(
			false,
		);
		expect(getStore("popup")?.state.open).toBe(true);

		click(document.querySelector("#open"));
		await settle();
		// The panel was shown when this click started, so it closes it.
		expect(getStore("popup")?.state.open).toBe(false);
	});

	it("runs the action in a view transition with transition", async () => {
		const transitions: Array<() => void> = [];
		const ready = Promise.resolve();
		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			value: (update: () => void) => {
				transitions.push(update);
				return { ready, finished: ready, updateCallbackDone: ready };
			},
		});
		try {
			document.body.innerHTML = `
				<div data-store="c">
					<a href="#" data-events--click.transition.prevent="@hit">Next</a>
					<span data-events--click="@hit"></span>
				</div>
			`;
			const { definition, received } = counter();
			Catalyst.start({ stores: { c: definition }, reactions: [events] });

			const event = click(document.querySelector("a"));
			// The default is prevented straight away, and the action waits for
			// the browser to capture the page.
			expect(event.defaultPrevented).toBe(true);
			expect(received).toHaveLength(0);
			transitions[0]?.();
			expect(received).toHaveLength(1);
		} finally {
			Reflect.deleteProperty(document, "startViewTransition");
		}
		await settle();
	});
});

describe("event modifier edge cases", () => {
	it("doesn't treat the click that renders an outside listener as outside it", async () => {
		document.body.innerHTML = `
			<div data-store="popup">
				<button id="open" data-events--click="@open">Popup</button>
				<div data-if="$open">
					<template><div id="panel" data-events--outside.click="@close"></div></template>
				</div>
			</div>
		`;
		const popup = defineStore({
			state: { open: false },
			actions: ({ setState }) => ({
				// Rendered between the click's capture and bubble phases.
				open: () => {
					setState((state) => {
						state.open = true;
					});
					flush();
				},
				close: () =>
					setState((state) => {
						state.open = false;
					}),
			}),
		});
		Catalyst.start({ stores: { popup }, reactions: [conditional, events] });

		click(document.querySelector("#open"));
		await settle();
		expect(document.querySelector("#panel")).not.toBeNull();
		click(document.body);
		await settle();
		expect(document.querySelector("#panel")).toBeNull();
	});

	it("drops a transition's action when its directive is disposed first", async () => {
		const updates: Array<() => void> = [];
		const ready = Promise.resolve();
		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			value: (update: () => void) => {
				updates.push(update);
				return { ready, finished: ready, updateCallbackDone: ready };
			},
		});
		try {
			document.body.innerHTML = `
				<div data-store="c"><button data-events--click.transition="@hit"></button></div>
			`;
			const { definition, received } = counter();
			Catalyst.start({ stores: { c: definition }, reactions: [events] });
			click(document.querySelector("button"));
			Catalyst.destroy();
			updates[0]?.();
			expect(received).toHaveLength(0);
		} finally {
			Reflect.deleteProperty(document, "startViewTransition");
		}
	});

	it("passes passive: false for prevent, since some page listeners are passive by default", () => {
		const add = vi.spyOn(window, "addEventListener");
		document.body.innerHTML = `
			<div data-store="c" data-events--window.touchmove.prevent="@hit"></div>
		`;
		const { definition } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });
		expect(add).toHaveBeenCalledWith("touchmove", expect.any(Function), {
			capture: false,
			passive: false,
		});
	});

	it("gives each loop item its own listener on a shared target", async () => {
		const items: string[] = [];
		document.body.innerHTML = `
			<ul data-store="list" data-loop="$rows">
				<template><li data-events--document.ping="@ping"></li></template>
			</ul>
		`;
		const list = defineStore({
			state: { rows: ["a", "b"] },
			actions: () => ({
				ping: (_event: Event, { item }: LoopItem<string>) => items.push(item),
			}),
		});
		Catalyst.start({ stores: { list }, reactions: [events, loop] });
		document.dispatchEvent(new Event("ping"));
		expect(items).toEqual(["a", "b"]);

		getStore("list")?.setState((state) => {
			(state.rows as string[]).shift();
		});
		await settle();
		items.length = 0;
		document.dispatchEvent(new Event("ping"));
		expect(items).toEqual(["b"]);
	});

	it("counts the debounced call that runs for once", async () => {
		vi.useFakeTimers();
		try {
			document.body.innerHTML = `
				<div data-store="c"><input data-events--input.once.debounce="@hit" /></div>
			`;
			const { definition, received } = counter();
			Catalyst.start({ stores: { c: definition }, reactions: [events] });
			const input = document.querySelector("input");
			const first = new Event("input");
			const last = new Event("input");
			input?.dispatchEvent(first);
			vi.advanceTimersByTime(100);
			input?.dispatchEvent(last);
			vi.advanceTimersByTime(250);
			expect(received).toEqual([last]);
			input?.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(250);
			expect(received).toEqual([last]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("decides again when the same event is dispatched again", () => {
		document.body.innerHTML = `
			<p id="page"></p>
			<div data-store="c" id="panel" data-events--outside.click="@hit"></div>
		`;
		const { definition, received } = counter();
		Catalyst.start({ stores: { c: definition }, reactions: [events] });
		const event = new MouseEvent("click", { bubbles: true });
		document.querySelector("#page")?.dispatchEvent(event);
		document.querySelector("#panel")?.dispatchEvent(event);
		expect(received).toEqual([event]);
	});

	it("uses the store's scope as the type of a transition", () => {
		const calls: unknown[] = [];
		const ready = Promise.resolve();
		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			value: (argument: unknown) => {
				calls.push(argument);
				return { ready, finished: ready, updateCallbackDone: ready };
			},
		});
		class FakeViewTransition {}
		Object.defineProperty(FakeViewTransition.prototype, "types", {
			value: new Set(),
		});
		vi.stubGlobal("ViewTransition", FakeViewTransition);
		try {
			document.body.innerHTML = `
				<div data-store="gallery"><button data-events--click.transition="@hit"></button></div>
			`;
			const { definition } = counter();
			Catalyst.start({ stores: { gallery: definition }, reactions: [events] });
			click(document.querySelector("button"));
			expect(calls[0]).toMatchObject({ types: ["gallery"] });
		} finally {
			Reflect.deleteProperty(document, "startViewTransition");
			vi.unstubAllGlobals();
		}
	});
});
