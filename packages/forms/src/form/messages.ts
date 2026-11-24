import C from "../constants.js";
import S from "../state.js";
import type { Message, Messages, MessageTokens } from "../types.js";
import { fill } from "./dom.js";

const A = C.attributes;

/** Writes a message from a template or function */
export const format = (message: Message, tokens: MessageTokens = {}) =>
	typeof message === "function" ? message(tokens) : fill(message, tokens);

/** One of the library's messages, from the options passed to `init` */
export const message = (key: keyof Messages, tokens?: MessageTokens) => {
	const value = S.settings.messages[key] ?? C.messages[key];
	return value === null ? "" : format(value, tokens);
};

/** `maxSize` is written `max-size` in attributes */
const kebab = (key: string) =>
	key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

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

/**
 * Chooses the message for a failed check. In order: the control's and then its
 * field wrapper's `data-form--message-{key}`, then their `data-form--message`,
 * then a rule's own message, then the message passed to `init`, then the
 * browser's own.
 */
export const failureMessage = (
	failure: Failure,
	sources: Array<Element | null>,
) => {
	const elements = sources.filter((source) => source !== null);
	const specific = `${A.messagePrefix}${kebab(failure.key)}`;
	for (const attribute of [specific, A.message]) {
		for (const element of elements) {
			const value = element.getAttribute(attribute);
			if (value) return format(value, failure.tokens);
		}
	}

	if (failure.text) return failure.text;
	const configured = S.settings.messages[failure.key as keyof Messages];
	if (configured) return format(configured, failure.tokens);
	if (failure.native) return failure.native;

	const fallback =
		C.fallbacks[failure.key as keyof typeof C.fallbacks] ??
		C.messages[failure.key as keyof Messages] ??
		C.messages.rule;
	return format(fallback, failure.tokens);
};
