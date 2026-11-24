import type { Message } from "../types.js";

const PLACEHOLDER = /\{(n|count)\}/g;

/** Replaces `{n}` and `{count}` in a template */
export const fill = (text: string, n: number, count: number) =>
	text.replace(PLACEHOLDER, (_, key: string) =>
		String(key === "n" ? n : count),
	);

/** Writes a message from a template or a function */
export const format = (message: Message, n: number, count: number) =>
	typeof message === "function"
		? message({ n, count })
		: fill(message, n, count);

const PLURALS = new Map<string, Intl.PluralRules>();

/** The plural category of a number in an element's language, such as `one` or `few` */
const pluralOf = (element: Element, value: number) => {
	const lang = element.closest("[lang]")?.getAttribute("lang") ?? "";
	let rules = PLURALS.get(lang);
	if (!rules) {
		try {
			rules = new Intl.PluralRules(lang || undefined);
		} catch {
			rules = new Intl.PluralRules();
		}
		PLURALS.set(lang, rules);
	}
	return rules.select(value);
};

/**
 * A message written in an attribute: the plural form for `value` in the
 * element's language, such as `data-carousel--message-status-one`, or else the
 * attribute without a suffix. Empty attributes are ignored, and `null` means
 * neither is set.
 */
export const attributeMessage = (
	element: Element,
	name: string,
	value: number,
) => {
	const plural = element.getAttribute(`${name}-${pluralOf(element, value)}`);
	return plural || element.getAttribute(name) || null;
};
