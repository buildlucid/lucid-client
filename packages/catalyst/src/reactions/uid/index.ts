import Catalyst from "../../runtime/catalyst.js";
import { getElementLoopContext } from "../../runtime/loop-context.js";
import { NO_ROOT } from "../../runtime/reactive.js";
import type { Reaction } from "../../types/index.js";

/** Generated ids by name, for each loop item, store or the page. */
const ids = new WeakMap<object, Map<string, string>>();
let count = 0;

/**
 * What a name is unique within: the nearest loop item or store, or the page,
 * so each item of a loop gets its own ids.
 */
const getScope = (element: Element): object => {
	const storeAttribute = `${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.store}`;
	for (let current: Element | null = element; current;) {
		const loop = getElementLoopContext(current);
		if (loop) return loop;
		if (current.hasAttribute(storeAttribute)) return current;
		current = current.parentElement;
	}
	return document;
};

const getId = (scope: object, name: string) => {
	let names = ids.get(scope);
	if (!names) {
		names = new Map();
		ids.set(scope, names);
	}
	let id = names.get(name);
	if (!id) {
		// Prefixed, and skipping ids already on the page, so it doesn't match
		// an id written in the markup.
		do {
			count += 1;
			id = `catalyst-${name}-${count}`;
		} while (document.getElementById(id));
		names.set(name, id);
	}
	return id;
};

/**
 * `data-uid="panel"` gives the element a unique id, and
 * `data-uid--aria-controls="panel"` writes the same id to another attribute,
 * such as `for`, `aria-controls` or `popovertarget`.
 */
const uidReaction: Reaction & { [NO_ROOT]: true } = {
	[NO_ROOT]: true,
	name: "uid",
	attribute: "uid",
	setup: (directive, context) => {
		const { element, attributeName } = directive;
		const names = directive.value.split(/\s+/).filter(Boolean);
		if (directive.reference || names.length === 0) {
			if (__DEV__)
				context.warn(
					`The "${attributeName}" directive requires a name, such as "panel".`,
				);
			return;
		}

		const attribute = directive.specifier || "id";
		const scope = getScope(element);
		// Several names, as `aria-labelledby` and `aria-describedby` accept.
		const value = names.map((name) => getId(scope, name)).join(" ");
		const initialValue = element.getAttribute(attribute);
		element.setAttribute(attribute, value);

		return () => {
			if (initialValue === null) element.removeAttribute(attribute);
			else element.setAttribute(attribute, initialValue);
		};
	},
};

export default uidReaction;
