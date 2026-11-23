import C from "../constants.js";

/** The elements inside a carousel that belong to it, rather than to a carousel nested inside it */
const owned = (root: HTMLElement, selector: string) =>
	Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
		(element) => element.closest(`[${C.attributes.root}]`) === root,
	);

export default owned;
