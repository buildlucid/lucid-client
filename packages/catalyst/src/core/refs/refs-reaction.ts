import Catalyst from "../../runtime/catalyst.js";
import { NO_ROOT } from "../../runtime/reactive.js";
import type { Reaction } from "../../types/index.js";

/**
 * Registers `data-ref="#name"` and `data-ref="#name[]"` elements on their
 * store. Refs are part of the core, so this reaction is always registered.
 */
const refsReaction: Reaction & { [NO_ROOT]: true } = {
	[NO_ROOT]: true,
	name: "refs",
	attribute: "ref",
	phase: "beforeStoreInit",
	setup: (directive, context) => {
		const reference = directive.reference;
		if (!reference || reference.type !== "identifier") {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires a #ref name.`,
				);
			return;
		}
		if (!reference.scope) {
			if (__DEV__)
				context.warn(
					`Cannot infer a store for the reference "${reference.raw}".`,
				);
			return;
		}

		const store = Catalyst.stores.get(reference.scope);
		if (!store) {
			if (__DEV__)
				context.warn(
					`Cannot find a store with the scope "${reference.scope}".`,
				);
			return;
		}

		const refs = store.refElements;
		const isArray = reference.key.endsWith("[]");
		const key = isArray ? reference.key.slice(0, -2) : reference.key;
		if (!key) return;

		if (isArray) {
			const existing = refs.get(key);
			const elements = Array.isArray(existing) ? existing : [];
			if (!elements.includes(directive.element)) {
				elements.push(directive.element);
			}
			refs.set(key, elements);

			return () => {
				const current = refs.get(key);
				if (!Array.isArray(current)) return;
				const index = current.indexOf(directive.element);
				if (index >= 0) current.splice(index, 1);
				if (current.length === 0) refs.delete(key);
			};
		}

		const existing = refs.get(key);
		if (existing && existing !== directive.element) {
			if (__DEV__)
				context.warn(
					`The ref "${key}" is already registered on store "${reference.scope}".`,
				);
			return;
		}

		refs.set(key, directive.element);
		return () => {
			if (refs.get(key) === directive.element) refs.delete(key);
		};
	},
};

export default refsReaction;
