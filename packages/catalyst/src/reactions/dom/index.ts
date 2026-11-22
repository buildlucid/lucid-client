import { stringifyState } from "../../helpers.js";
import type { Reaction } from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";

const SPECIFIERS = ["text", "html", "value", "focus", "blur", "scrollto"];

/** Nullish values render as empty content rather than "null"/"undefined". */
const toText = (value: unknown) =>
	value === null || value === undefined ? "" : stringifyState(value);

const isFocusable = (element: Element): element is HTMLElement | SVGElement =>
	"focus" in element && typeof element.focus === "function";

const updateDom = (element: Element, specifier: string, value: unknown) => {
	switch (specifier) {
		case "html":
			element.innerHTML = toText(value);
			return;
		case "value":
			if (
				element instanceof HTMLInputElement ||
				element instanceof HTMLTextAreaElement ||
				element instanceof HTMLSelectElement
			) {
				element.value = toText(value);
			}
			return;
		case "focus":
			if (value === true && isFocusable(element)) {
				// Deferred so it wins over a trap moving focus in the same update.
				setTimeout(() => {
					if (element.isConnected) element.focus();
				}, 0);
			}
			return;
		case "blur":
			if (value === true && isFocusable(element)) element.blur();
			return;
		case "scrollto":
			if (value === true) element.scrollIntoView({ behavior: "smooth" });
			return;
		default:
			element.textContent = toText(value);
	}
};

const domReaction: Reaction = {
	name: "dom",
	attribute: "dom",
	setup: (directive, context) => {
		if (directive.reference?.type === "identifier") {
			context.warn(
				`The "${directive.attributeName}" directive requires state or an action.`,
			);
			return;
		}

		const specifier = directive.specifier || "text";
		if (!SPECIFIERS.includes(specifier)) {
			context.warn(
				`The "${directive.attributeName}" directive has an unknown specifier. Use one of: ${SPECIFIERS.join(", ")}.`,
			);
			return;
		}

		createResolvedEffect(directive, context, (value) => {
			updateDom(directive.element, specifier, value);
		});
		return undefined;
	},
};

export default domReaction;
