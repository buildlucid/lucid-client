import C from "../constants.js";

const A = C.attributes;

/** The `data-carousel` element an id names: the carousel itself, or its track */
const rootFor = (id: string) => {
	const element = document.getElementById(id);
	if (!element) return null;
	if (element.hasAttribute(A.root)) return element;
	if (element.hasAttribute(A.track))
		return element.closest<HTMLElement>(`[${A.root}]`);
	return null;
};

/**
 * The carousel a control or marker operates: the one its `aria-controls`
 * names, by the id of its root or track, or else the carousel it sits inside
 */
const controlledRoot = (element: Element): HTMLElement | null => {
	for (const id of (element.getAttribute("aria-controls") ?? "").split(/\s+/)) {
		const root = id ? rootFor(id) : null;
		if (root) return root;
	}
	return element.closest<HTMLElement>(`[${A.root}]`);
};

export default controlledRoot;
