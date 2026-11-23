import type { Reaction } from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";

/** HTML, SVG and MathML elements have inline styles. */
const hasInlineStyle = (
	element: Element,
): element is Element & ElementCSSInlineStyle =>
	typeof (element as Partial<ElementCSSInlineStyle>).style?.setProperty ===
	"function";

/**
 * The text a value is written as. `null` removes the property, so
 * `var(--name, fallback)` uses its fallback, and `undefined` marks a value
 * with no CSS meaning, such as an object or array.
 */
const toPropertyValue = (value: unknown): string | null | undefined => {
	if (value === null || value === undefined || value === "") return null;
	switch (typeof value) {
		case "string":
			return value;
		case "number":
		case "bigint":
		case "boolean":
			return String(value);
		default:
			return undefined;
	}
};

const cssReaction: Reaction = {
	name: "css",
	attribute: "css",
	setup: (directive, context) => {
		const { element, specifier, attributeName } = directive;
		if (!specifier) {
			if (__DEV__)
				context.warn(
					"CSS directives require a custom property name specifier.",
				);
			return;
		}
		// Reserved for modifiers, and not valid in an unescaped CSS name.
		if (specifier.includes(".")) {
			if (__DEV__)
				context.warn(
					`The "${attributeName}" directive's custom property name can't contain ".".`,
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
		if (!hasInlineStyle(element)) {
			if (__DEV__)
				context.warn(
					`The "${attributeName}" directive requires an element with inline styles.`,
				);
			return;
		}

		const { style } = element;
		const property = `--${specifier}`;
		// Restored when the directive is disposed, so a server-rendered value
		// such as style="--progress: 30%" isn't lost.
		const initialValue = style.getPropertyValue(property);
		const initialPriority = style.getPropertyPriority(property);

		createResolvedEffect(
			directive,
			context,
			(value) => {
				const next = toPropertyValue(value);
				if (next === undefined) {
					if (__DEV__)
						context.warn(
							`The "${attributeName}" directive must resolve to a string, number or boolean.`,
						);
				}
				if (next) style.setProperty(property, next);
				else style.removeProperty(property);
			},
			{ distinct: true },
		);

		return () => {
			if (initialValue) {
				style.setProperty(property, initialValue, initialPriority);
			} else {
				style.removeProperty(property);
			}
		};
	},
};

export default cssReaction;
