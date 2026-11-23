import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import Catalyst, { defineStore, viewTransition } from "../src/index.js";
import { dom } from "../src/reactions.js";
import { allowConsoleErrors, getStore } from "./utils.js";

type Update = () => void;

/** Stubs `document.startViewTransition`, recording each call's argument. */
const stubTransitions = () => {
	const calls: Array<Update | { update: Update; types: string[] }> = [];
	const transition = {
		// A skipped transition rejects `ready`, which mustn't go unhandled.
		get ready() {
			return Promise.reject(new Error("skipped"));
		},
		finished: Promise.resolve(),
		updateCallbackDone: Promise.resolve(),
	};
	Object.defineProperty(document, "startViewTransition", {
		configurable: true,
		value: (argument: Update | { update: Update; types: string[] }) => {
			calls.push(argument);
			return transition;
		},
	});
	return { calls, transition };
};

const runUpdate = (call: Update | { update: Update } | undefined) => {
	if (typeof call === "function") call();
	else call?.update();
};

const start = () => {
	document.body.innerHTML = `<p data-store="page" data-dom--text="$title"></p>`;
	const page = defineStore({ state: { title: "Before" } });
	Catalyst.start({ stores: { page }, reactions: [dom] });
	const setTitle = (title: string) =>
		getStore("page")?.setState((state) => {
			state.title = title;
		});
	return { setTitle, text: () => document.querySelector("p")?.textContent };
};

describe("viewTransition", () => {
	afterEach(() => {
		Reflect.deleteProperty(document, "startViewTransition");
		Reflect.deleteProperty(globalThis, "ViewTransition");
		vi.unstubAllGlobals();
	});

	it("applies the update's state changes before the new page is captured", () => {
		const { calls, transition } = stubTransitions();
		const { setTitle, text } = start();

		const result = viewTransition(() => setTitle("After"));
		expect(result).toBe(transition);
		expect(text()).toBe("Before");
		runUpdate(calls[0]);
		// Flushed inside the update, not on the next microtask.
		expect(text()).toBe("After");
	});

	it("runs the update straight away without support or with reduced motion", () => {
		const { setTitle, text } = start();
		expect(viewTransition(() => setTitle("No support"))).toBeUndefined();
		expect(text()).toBe("No support");

		const { calls } = stubTransitions();
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("reduce"),
		}));
		expect(viewTransition(() => setTitle("Reduced"))).toBeUndefined();
		expect(text()).toBe("Reduced");
		expect(calls).toHaveLength(0);
	});

	it("passes types where the browser supports them", () => {
		const { calls } = stubTransitions();
		start();
		viewTransition(() => {}, { types: ["forward"] });
		expect(typeof calls[0]).toBe("function");

		vi.stubGlobal(
			"ViewTransition",
			class {
				types = new Set();
			},
		);
		// `types` is checked on the prototype.
		Object.defineProperty(
			(globalThis as unknown as { ViewTransition: { prototype: object } })
				.ViewTransition.prototype,
			"types",
			{ value: new Set() },
		);
		viewTransition(() => {}, { types: ["forward"] });
		expect(calls[1]).toMatchObject({ types: ["forward"] });
	});

	it("logs an update that throws and still applies what it changed", () => {
		allowConsoleErrors();
		const { calls } = stubTransitions();
		const { setTitle, text } = start();
		viewTransition(() => {
			setTitle("Partly");
			throw new Error("failed");
		});
		expect(() => runUpdate(calls[0])).not.toThrow();
		expect(text()).toBe("Partly");
	});

	it("reports an async update's rejection", async () => {
		allowConsoleErrors();
		const errors = vi.spyOn(console, "error");
		start();
		viewTransition(async () => {
			throw new Error("async failure");
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(errors).toHaveBeenCalledWith(
			expect.objectContaining({ message: "async failure" }),
		);
	});
});
