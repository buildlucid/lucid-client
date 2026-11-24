import C from "../constants.js";
import S from "../state.js";
import type { Messages } from "../types.js";

/** `accepted` is written `accepted` in attributes, and names such as `myMessage` as `my-message` */
const kebab = (key: string) =>
	key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * One of the library's messages: the element's own `data-cookie--message-{name}`
 * attribute, or else the one passed to `init`, or else the English default.
 * Empty attributes are ignored, and an empty message passed to `init` writes nothing.
 */
const message = (key: keyof Messages, element?: Element) =>
	element?.getAttribute(`${C.attributes.message}-${kebab(key)}`) ||
	(S.options.messages[key] ?? C.messages[key]);

export default message;
