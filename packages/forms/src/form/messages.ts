import C from "../constants.js";
import S from "../state.js";
import type { Message, Messages, MessageTokens } from "../types.js";
import { type Context, warnOnce } from "./context.js";
import { fill } from "./dom.js";

const A = C.attributes;

/** Writes a message from a template or function */
export const format = (message: Message, tokens: MessageTokens = {}) =>
	typeof message === "function" ? message(tokens) : fill(message, tokens);

/** `maxSize` is written `max-size` in attributes */
const kebab = (key: string) =>
	key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The language an element is in, from the closest `lang` attribute */
const langOf = (element: Element) =>
	element.closest("[lang]")?.getAttribute("lang") ?? "";

const PLURALS = new Map<string, Intl.PluralRules>();

/** The plural category of a number in an element's language, such as `one` or `few` */
const pluralOf = (element: Element, value: number) => {
	const lang = langOf(element);
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

/** The number a message's plural form follows: `{count}`, or else a numeric `{limit}` */
const pluralNumber = ({ count, limit }: MessageTokens) => {
	if (count !== undefined) return count;
	if (typeof limit === "number") return limit;
	return limit && /^\d+$/.test(limit) ? Number(limit) : undefined;
};

/**
 * A message written in an attribute: the plural form for the tokens' number in
 * the element's language, such as `data-form--message-remaining-one`, or else
 * the attribute without a suffix. Empty attributes are ignored.
 */
const attributeMessage = (
	element: Element,
	name: string,
	tokens: MessageTokens,
) => {
	const value = pluralNumber(tokens);
	if (value !== undefined) {
		const plural = element.getAttribute(`${name}-${pluralOf(element, value)}`);
		if (plural) return plural;
	}
	return element.getAttribute(name) || null;
};

/** `from` and the elements around it inside the form, then the form, where message attributes are looked for */
const around = (ctx: Context, from: Element | null) => {
	const elements: Element[] = [];
	for (
		let element = from;
		element && element !== ctx.form && ctx.form.contains(element);
		element = element.parentElement
	)
		elements.push(element);
	elements.push(ctx.form);
	return elements;
};

/** The first of the elements with the message attribute, written with the tokens */
const firstAttribute = (
	elements: Element[],
	name: string,
	tokens: MessageTokens,
) => {
	for (const element of elements) {
		const value = attributeMessage(element, name, tokens);
		if (value) return fill(value, tokens);
	}
	return null;
};

/**
 * One of the library's messages. In order: `data-form--message-{key}` on
 * `from`, an element around it or the form, then the messages passed to
 * `init`, then the English default.
 */
export const message = (
	ctx: Context,
	key: keyof Messages,
	tokens: MessageTokens = {},
	from: Element | null = null,
) => {
	const own = firstAttribute(
		around(ctx, from),
		`${A.messagePrefix}${kebab(key)}`,
		tokens,
	);
	if (own !== null) return own;
	const value = S.settings.messages[key] ?? C.messages[key];
	return value === null ? "" : format(value, tokens);
};

/** A check that failed, before its message is chosen */
export type Failure = {
	/** A message key, such as `required` or `maxSize`, or a rule's name */
	key: string;
	tokens: MessageTokens;
	/** The browser's own message, for native constraints */
	native?: string;
	/** A message a rule returned */
	text?: string;
};

/** The primary language of a tag, such as `en` for `en-GB` */
const primary = (lang: string) => lang.split("-")[0]?.toLowerCase() ?? "";

/**
 * Chooses the message for a failed check. In order: the control's and then its
 * field wrapper's `data-form--message-{key}`, then their `data-form--message`,
 * then `data-form--message-{key}` on an element around them or the form, then
 * a rule's own message, then the message passed to `init`, then the browser's
 * own. Plural forms such as `data-form--message-min-checked-one` are picked by
 * the check's limit.
 */
export const failureMessage = (
	ctx: Context,
	failure: Failure,
	control: Element,
	wrapper: Element | null,
) => {
	const nearest = wrapper ? [control, wrapper] : [control];
	const specific = `${A.messagePrefix}${kebab(failure.key)}`;
	const own =
		firstAttribute(nearest, specific, failure.tokens) ??
		firstAttribute(nearest, A.message, failure.tokens) ??
		firstAttribute(
			around(ctx, (wrapper ?? control).parentElement),
			specific,
			failure.tokens,
		);
	if (own !== null) return own;

	if (failure.text) return failure.text;
	const configured = S.settings.messages[failure.key as keyof Messages];
	if (configured) return format(configured, failure.tokens);
	if (failure.native) {
		const page = primary(langOf(control));
		const browser = primary(navigator.language ?? "");
		if (__DEV__ && page && browser && page !== browser)
			warnOnce(
				ctx,
				`The browser's own "${failure.key}" message is in its language, which isn't the page's. Set it with data-form--message-${kebab(failure.key)} or the messages option.`,
			);
		return failure.native;
	}

	const fallback =
		C.fallbacks[failure.key as keyof typeof C.fallbacks] ??
		C.messages[failure.key as keyof Messages] ??
		C.messages.rule;
	return format(fallback, failure.tokens);
};
