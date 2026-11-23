import type { SyncOptions } from "../types/index.js";

/**
 * The target and every element inside it, in document order. Elements are
 * pushed one at a time, since spreading a very large list into `push` would
 * overflow the call stack.
 */
const collectElements = (target: Element, options?: SyncOptions) => {
	if (!target.firstElementChild) return options?.childrenOnly ? [] : [target];
	const descendants = target.querySelectorAll("*");
	const elements: Element[] = options?.childrenOnly ? [] : [target];
	for (let index = 0; index < descendants.length; index += 1) {
		elements.push(descendants[index] as Element);
	}
	return elements;
};

export default collectElements;
