import { NO_ROOT } from "../../runtime/reactive.js";
import type { Reaction } from "../../types/index.js";
import callAction from "../utils/call-action.js";
import { splitModifiers } from "../utils/modifiers.js";

type Callback = (entry: IntersectionObserverEntry) => void;

type SharedObserver = {
	observer: IntersectionObserver;
	callbacks: Map<Element, Set<Callback>>;
};

/** One observer for each threshold and margin, shared by every element using them. */
const observers = new Map<string, SharedObserver>();

const observe = (
	element: Element,
	options: { threshold: number; rootMargin: string },
	callback: Callback,
) => {
	const key = `${options.threshold} ${options.rootMargin}`;
	let shared = observers.get(key);
	if (!shared) {
		const callbacks = new Map<Element, Set<Callback>>();
		const observer = new IntersectionObserver((entries) => {
			// Recipients are read before any action runs, so callbacks added
			// meanwhile, such as by an action that syncs, wait for their own
			// first report, and removed ones are skipped.
			const deliveries = entries.map(
				(entry) =>
					[entry, Array.from(callbacks.get(entry.target) ?? [])] as const,
			);
			for (const [entry, recipients] of deliveries) {
				const current = callbacks.get(entry.target);
				for (const run of recipients) {
					if (current?.has(run)) run(entry);
				}
			}
		}, options);
		shared = { observer, callbacks };
		observers.set(key, shared);
	}
	const { observer, callbacks } = shared;
	let elementCallbacks = callbacks.get(element);
	if (!elementCallbacks) {
		elementCallbacks = new Set();
		callbacks.set(element, elementCallbacks);
	} else {
		// Observing again reports where the element is now, which a callback
		// added after the first report needs. Others ignore an unchanged entry.
		observer.unobserve(element);
	}
	elementCallbacks.add(callback);
	observer.observe(element);

	const owned = elementCallbacks;
	return () => {
		owned.delete(callback);
		if (owned.size > 0) return;
		callbacks.delete(element);
		observer.unobserve(element);
		if (callbacks.size > 0) return;
		observer.disconnect();
		if (observers.get(key) === shared) observers.delete(key);
	};
};

/**
 * How much of the element must be visible: `half` and `full` raise it from
 * any. `full` allows for rounding, since browsers can report a fully visible
 * element as slightly less than 1.
 */
const THRESHOLDS: Record<string, number> = { half: 0.5, full: 0.99 };

/**
 * Calls an action when the element scrolls into view, or out of it with
 * `leave`. `once` stops after the first call, `half` and `full` wait until
 * that much of the element is visible, and a length such as `200px` grows the
 * viewport by that much on every side, to start earlier.
 */
const intersectReaction: Reaction & { [NO_ROOT]: true } = {
	[NO_ROOT]: true,
	name: "intersect",
	attribute: "intersect",
	setup: (directive, context) => {
		const reference = directive.reference;
		const { element, attributeName } = directive;
		if (!reference || reference.type !== "action") {
			if (__DEV__)
				context.warn(`The "${attributeName}" directive requires an action.`);
			return;
		}
		if (typeof IntersectionObserver !== "function") return;

		let leave = false;
		let once = false;
		let threshold = 0;
		let rootMargin = "0px";
		for (const modifier of splitModifiers(directive.specifier)) {
			if (modifier === "enter") leave = false;
			else if (modifier === "leave") leave = true;
			else if (modifier === "once") once = true;
			else if (Object.hasOwn(THRESHOLDS, modifier))
				threshold = THRESHOLDS[modifier] ?? 0;
			else if (/^-?\d+(px|%)$/.test(modifier)) rootMargin = modifier;
			else if (__DEV__)
				context.warn(
					`The "${attributeName}" directive has an unknown modifier "${modifier}". Use enter, leave, once, half, full or a margin such as 200px.`,
				);
		}

		// Whether the element is in view, so the action runs when that changes.
		// It starts out of view, so `leave` only runs after the element entered.
		let inView = false;
		let stop: (() => void) | null = null;
		stop = observe(element, { threshold, rootMargin }, (entry) => {
			const visible =
				entry.isIntersecting && entry.intersectionRatio >= threshold;
			if (visible === inView) return;
			inView = visible;
			if (visible === leave) return;
			if (once) {
				stop?.();
				stop = null;
			}
			callAction(reference, entry, context);
		});

		return () => {
			stop?.();
			stop = null;
		};
	},
};

export default intersectReaction;
