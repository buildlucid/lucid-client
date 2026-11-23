import C from "../constants.js";
import S from "../state.js";
import type { Carousel } from "../types.js";

/**
 * Returns the carousel for an element, or for the id of its root or track
 * - Any element inside a carousel returns that carousel
 */
const get = (target: Element | string): Carousel | undefined => {
	const element =
		typeof target === "string" ? document.getElementById(target) : target;
	const root = element?.closest(`[${C.attributes.root}]`);
	return root instanceof HTMLElement ? S.instances.get(root)?.api : undefined;
};

export default get;
