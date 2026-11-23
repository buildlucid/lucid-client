import { stringifyState } from "../../helpers.js";
import type { Reaction } from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";
import { readSerialised } from "../utils/read-value.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// HTML lowercases attribute names, but these SVG attributes are case-sensitive.
const SVG_ATTRIBUTES = new Map(
	[
		"attributeName",
		"baseFrequency",
		"clipPathUnits",
		"diffuseConstant",
		"edgeMode",
		"filterUnits",
		"gradientTransform",
		"gradientUnits",
		"kernelMatrix",
		"kernelUnitLength",
		"keyPoints",
		"keySplines",
		"keyTimes",
		"lengthAdjust",
		"limitingConeAngle",
		"markerHeight",
		"markerUnits",
		"markerWidth",
		"maskContentUnits",
		"maskUnits",
		"numOctaves",
		"pathLength",
		"patternContentUnits",
		"patternTransform",
		"patternUnits",
		"pointsAtX",
		"pointsAtY",
		"pointsAtZ",
		"preserveAlpha",
		"preserveAspectRatio",
		"primitiveUnits",
		"refX",
		"refY",
		"repeatCount",
		"repeatDur",
		"specularConstant",
		"specularExponent",
		"spreadMethod",
		"startOffset",
		"stdDeviation",
		"surfaceScale",
		"systemLanguage",
		"tableValues",
		"targetX",
		"targetY",
		"textLength",
		"viewBox",
		"xChannelSelector",
		"yChannelSelector",
	].map((name) => [name.toLowerCase(), name]),
);

// Attributes whose "false" value is meaningful, so it is written rather than
// removing the attribute.
const ENUMERATED_ATTRIBUTES = new Set([
	"contenteditable",
	"draggable",
	"spellcheck",
]);

const keepsFalseValue = (name: string) =>
	name.startsWith("aria-") ||
	name.startsWith("data-") ||
	ENUMERATED_ATTRIBUTES.has(name);

const getAttributeName = (element: Element, specifier: string) =>
	element.namespaceURI === SVG_NAMESPACE
		? (SVG_ATTRIBUTES.get(specifier) ?? specifier)
		: specifier;

/**
 * `null` and `undefined` remove the attribute. Booleans follow HTML boolean
 * attribute semantics (present or absent), except for `aria-*`, `data-*` and
 * enumerated attributes, which receive the strings "true" and "false".
 */
export const writeAttribute = (
	element: Element,
	name: string,
	value: unknown,
) => {
	if (value === null || value === undefined) {
		element.removeAttribute(name);
		return;
	}
	if (typeof value === "boolean" && !keepsFalseValue(name)) {
		if (value) element.setAttribute(name, "");
		else element.removeAttribute(name);
		return;
	}
	element.setAttribute(name, stringifyState(value));
};

const bindReaction: Reaction = {
	name: "bind",
	attribute: "bind",
	setup: (directive, context) => {
		if (!directive.specifier) {
			if (__DEV__)
				context.warn("Bind directives require a target attribute specifier.");
			return;
		}
		if (directive.reference?.type === "identifier") {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires state or an action.`,
				);
			return;
		}

		const name = getAttributeName(directive.element, directive.specifier);
		createResolvedEffect(
			directive,
			context,
			(value) => {
				writeAttribute(directive.element, name, value);
			},
			{ read: readSerialised },
		);
		return undefined;
	},
};

export default bindReaction;
