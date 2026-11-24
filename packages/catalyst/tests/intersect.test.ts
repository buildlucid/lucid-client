import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import Catalyst, { defineStore } from "../src/index.js";
import { intersect } from "../src/reactions.js";
import { catalystWarnings, settle } from "./utils.js";

type Callback = (entries: IntersectionObserverEntry[]) => void;

/** Observers created by the reaction, so a test can report entries to them. */
const observers: FakeObserver[] = [];

class FakeObserver {
	elements = new Set<Element>();
	disconnected = false;
	constructor(
		public callback: Callback,
		public options: IntersectionObserverInit,
	) {
		observers.push(this);
	}
	observe(element: Element) {
		this.elements.add(element);
	}
	unobserve(element: Element) {
		this.elements.delete(element);
	}
	disconnect() {
		this.disconnected = true;
		this.elements.clear();
	}
	/** Reports the element at `ratio` visible. */
	report(element: Element, ratio: number) {
		if (!this.elements.has(element)) return;
		this.callback([
			{
				target: element,
				isIntersecting: ratio > 0,
				intersectionRatio: ratio,
			} as unknown as IntersectionObserverEntry,
		]);
	}
}

const report = (element: Element | null, ratio: number) => {
	if (!element) return;
	for (const observer of observers) observer.report(element, ratio);
};

const recorder = () => {
	const calls: string[] = [];
	const definition = defineStore({
		actions: () => ({
			enter: (entry: IntersectionObserverEntry) =>
				calls.push(`enter ${entry.intersectionRatio}`),
			leave: () => calls.push("leave"),
		}),
	});
	return { calls, definition };
};

describe("intersect reaction", () => {
	beforeEach(() => {
		observers.length = 0;
		vi.stubGlobal("IntersectionObserver", FakeObserver);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("calls an action when the element enters and leaves the viewport", async () => {
		document.body.innerHTML = `
			<div data-store="s">
				<img id="image" data-intersect="@enter" data-intersect--leave="@leave" />
			</div>
		`;
		const { calls, definition } = recorder();
		Catalyst.init({ stores: { s: definition }, reactions: [intersect] });
		const image = document.querySelector("#image");

		// Starting out of view isn't leaving.
		report(image, 0);
		expect(calls).toEqual([]);
		report(image, 0.2);
		report(image, 0.6);
		report(image, 0);
		report(image, 1);
		expect(calls).toEqual(["enter 0.2", "leave", "enter 1"]);
		// Both directives share one observer.
		expect(observers).toHaveLength(1);
		await settle();
	});

	it("stops after the first call with once, and waits for half or full", async () => {
		document.body.innerHTML = `
			<div data-store="s">
				<div id="once" data-intersect--once="@enter"></div>
				<div id="half" data-intersect--half="@enter"></div>
				<div id="ahead" data-intersect--once.200px="@enter"></div>
			</div>
		`;
		const { calls, definition } = recorder();
		Catalyst.init({ stores: { s: definition }, reactions: [intersect] });

		const once = document.querySelector("#once");
		report(once, 1);
		report(once, 0);
		report(once, 1);
		expect(calls).toEqual(["enter 1"]);

		const half = document.querySelector("#half");
		report(half, 0.3);
		expect(calls).toEqual(["enter 1"]);
		report(half, 0.5);
		expect(calls).toEqual(["enter 1", "enter 0.5"]);

		const options = observers.map((observer) => observer.options);
		expect(options).toContainEqual({ threshold: 0.5, rootMargin: "0px" });
		expect(options).toContainEqual({ threshold: 0, rootMargin: "200px" });
		await settle();
	});

	it("stops observing removed elements and warns about unknown modifiers", async () => {
		document.body.innerHTML = `
			<div data-store="s"><p data-intersect--soon.constructor="@enter"></p></div>
		`;
		const { calls, definition } = recorder();
		Catalyst.init({ stores: { s: definition }, reactions: [intersect] });
		const p = document.querySelector("p");
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('unknown modifier "soon"'),
		);
		// Not read from the object's prototype.
		expect(catalystWarnings()).toContainEqual(
			expect.stringContaining('unknown modifier "constructor"'),
		);
		expect(observers[0]?.options.threshold).toBe(0);

		document.body.innerHTML = "";
		await settle();
		expect(observers[0]?.disconnected).toBe(true);
		report(p, 1);
		expect(calls).toEqual([]);
	});
});
