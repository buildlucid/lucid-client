import type { Reaction } from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";
import {
	isCheckable,
	isField,
	observeOptions,
	readFieldValue,
	setFieldValue,
	toText,
} from "../utils/fields.js";
import { readSerialised } from "../utils/read-value.js";

const SPECIFIERS = [
	"text",
	"html",
	"value",
	"checked",
	"focus",
	"blur",
	"scrollto",
];

/**
 * Sets an element's text. When it already holds a single text node, that node
 * is updated, or left alone when the text is the same, rather than replaced.
 */
const setText = (element: Element, text: string) => {
	const first = element.firstChild;
	if (
		first &&
		first === element.lastChild &&
		first.nodeType === Node.TEXT_NODE
	) {
		const node = first as Text;
		if (node.data !== text) node.data = text;
		return;
	}
	if (first || text) element.textContent = text;
};

const isFocusable = (element: Element): element is HTMLElement | SVGElement =>
	"focus" in element && typeof element.focus === "function";

const updateDom = (element: Element, specifier: string, value: unknown) => {
	switch (specifier) {
		case "html":
			element.innerHTML = toText(value);
			return;
		case "value":
			if (isField(element)) setFieldValue(element, value);
			return;
		case "checked":
			// The property, not the attribute: the attribute is only the default,
			// and stops applying once the field has been clicked.
			if (isCheckable(element)) element.checked = Boolean(value);
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
			setText(element, toText(value));
	}
};

const domReaction: Reaction = {
	name: "dom",
	attribute: "dom",
	setup: (directive, context) => {
		if (directive.reference?.type === "identifier") {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires state or an action.`,
				);
			return;
		}

		const specifier = directive.specifier || "text";
		if (!SPECIFIERS.includes(specifier)) {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive has an unknown specifier. Use one of: ${SPECIFIERS.join(", ")}.`,
				);
			return;
		}

		// A select's value is applied again when its options change, so a value
		// whose option is rendered later, such as by a loop, is still selected.
		const select =
			specifier === "value" && directive.element instanceof HTMLSelectElement
				? directive.element
				: null;
		let current: { value: unknown } | null = null;

		createResolvedEffect(
			directive,
			context,
			(value) => {
				current = { value };
				updateDom(directive.element, specifier, value);
			},
			{ read: specifier === "value" ? readFieldValue : readSerialised },
		);

		if (!select) return undefined;
		return observeOptions(select, () => {
			if (current) setFieldValue(select, current.value);
		});
	},
};

export default domReaction;
