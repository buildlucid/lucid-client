import type { Reaction } from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";

const splitClasses = (value: string) => value.split(/\s+/).filter(Boolean);

/**
 * The class names a value applies: a string of names, an array of them, or an
 * object whose truthy keys are applied. `null`, `undefined` and `false` apply
 * none, and any other value is `undefined`, since it names no class.
 */
const toClassNames = (value: unknown): string[] | undefined => {
	if (value === null || value === undefined || value === false) return [];
	if (typeof value === "string") return splitClasses(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) =>
			typeof item === "string" ? splitClasses(item) : [],
		);
	}
	if (typeof value === "object") {
		return Object.entries(value).flatMap(([names, on]) =>
			on ? splitClasses(names) : [],
		);
	}
	return undefined;
};

/** Copies arrays and objects while tracking, so changing their contents updates. */
const readClasses = (value: unknown) => {
	if (Array.isArray(value)) return [...(value as unknown[])];
	if (typeof value === "object" && value !== null) return { ...value };
	return value;
};

/**
 * The class directives of one element: how many apply each class, and whether
 * the markup had each class before any of them changed it.
 */
type ElementClasses = {
	counts: Map<string, number>;
	initial: Map<string, boolean>;
};

const elementClasses = new WeakMap<Element, ElementClasses>();

const getElementClasses = (element: Element) => {
	let classes = elementClasses.get(element);
	if (!classes) {
		classes = { counts: new Map(), initial: new Map() };
		elementClasses.set(element, classes);
	}
	return classes;
};

const classReaction: Reaction = {
	name: "classes",
	attribute: "class",
	setup: (directive, context) => {
		const { element, specifier, attributeName } = directive;
		// Reserved for modifiers, as in other reactions.
		if (specifier.includes(".")) {
			if (__DEV__)
				context.warn(
					`The "${attributeName}" directive's class name can't contain ".".`,
				);
			return;
		}
		if (directive.reference?.type === "identifier") {
			if (__DEV__)
				context.warn(
					`The "${attributeName}" directive requires state or an action.`,
				);
			return;
		}

		const { classList } = element;
		// Shared with the element's other class directives, so the markup's own
		// classes come back once none of them applies a class.
		const { counts, initial } = getElementClasses(element);
		// Classes this directive applies, which another class directive on the
		// element can't remove while it does.
		const claimed = new Set<string>();
		// Classes this directive has written, which it restores when disposed.
		const touched = new Set<string>();
		const write = (name: string, on: boolean) => {
			if (!initial.has(name)) initial.set(name, classList.contains(name));
			touched.add(name);
			// Writing a class that is already set would still queue a mutation.
			if (classList.contains(name) !== on) classList.toggle(name, on);
		};
		const claim = (name: string) => {
			if (!claimed.has(name)) {
				claimed.add(name);
				counts.set(name, (counts.get(name) ?? 0) + 1);
			}
			write(name, true);
		};
		const unclaim = (name: string) => {
			if (!claimed.delete(name)) return;
			const left = (counts.get(name) ?? 1) - 1;
			if (left > 0) counts.set(name, left);
			else counts.delete(name);
		};
		/** Stops applying a class, removing it unless another directive applies it. */
		const release = (name: string, keepInitial: boolean) => {
			unclaim(name);
			if (counts.has(name)) return;
			if (keepInitial && initial.get(name)) return;
			write(name, false);
		};

		if (specifier) {
			// It owns its one class, so `false` removes it even when the markup
			// had it.
			createResolvedEffect(
				directive,
				context,
				(value) => {
					if (value) claim(specifier);
					else release(specifier, false);
				},
				{ read: (value) => Boolean(value), distinct: true },
			);
		} else {
			// Only classes the directive added are removed, so classes the
			// markup already had are left alone.
			createResolvedEffect(
				directive,
				context,
				(value) => {
					let names = toClassNames(value);
					if (!names) {
						if (__DEV__)
							context.warn(
								`The "${attributeName}" directive must resolve to a string, an array of strings or an object.`,
							);
						names = [];
					}
					const next = new Set(names);
					for (const name of Array.from(claimed)) {
						if (!next.has(name)) release(name, true);
					}
					for (const name of next) claim(name);
				},
				{ read: readClasses },
			);
		}

		return () => {
			for (const name of Array.from(claimed)) unclaim(name);
			for (const name of touched) {
				const was = initial.get(name) ?? false;
				if (!counts.has(name) && classList.contains(name) !== was) {
					classList.toggle(name, was);
				}
			}
		};
	},
};

export default classReaction;
