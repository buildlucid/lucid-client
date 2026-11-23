import createCarousel from "../carousel/create.js";
import C from "../constants.js";
import S, { type Instance } from "../state.js";
import type { Carousel } from "../types.js";
import controlledRoot from "./controlled-root.js";

const A = C.attributes;

const notify = (type: "create" | "destroy", carousel: Carousel) => {
	for (const listener of S.listeners) listener(type, carousel);
};

/** Removes a destroyed carousel from the registry */
export const forget = (carousel: Carousel) => {
	S.instances.delete(carousel.element);
	notify("destroy", carousel);
};

/** The elements matching `selector`, in page order, grouped by the carousel each operates */
const operatedBy = (selector: string) => {
	const groups = new Map<Element, HTMLElement[]>();
	for (const element of document.querySelectorAll<HTMLElement>(selector)) {
		const root = controlledRoot(element);
		if (!root) continue;
		const group = groups.get(root);
		if (group) group.push(element);
		else groups.set(root, [element]);
	}
	return groups;
};

/**
 * Enhances every `data-carousel` element that isn't enhanced yet. They set
 * their attributes, measure and write their state in turn, so the page is only
 * laid out once however many there are. Their controls and markers are found
 * once for all of them, rather than each searching the page.
 */
const scan = () => {
	const roots = Array.from(
		document.querySelectorAll<HTMLElement>(`[${A.root}]`),
	).filter((root) => !S.instances.has(root));
	if (roots.length === 0) return;
	const controls = operatedBy(`[${A.action}]`);
	const markers = operatedBy(`[${A.marker}]`);

	const created: Instance[] = [];
	for (const root of roots) {
		const instance = createCarousel(root, forget, {
			controls: controls.get(root) ?? [],
			markers: markers.get(root) ?? [],
		});
		if (!instance) continue;
		S.instances.set(root, instance);
		created.push(instance);
	}
	for (const instance of created) instance.measure();
	for (const instance of created) instance.start();
	for (const instance of created) notify("create", instance.api);
};

export default scan;
