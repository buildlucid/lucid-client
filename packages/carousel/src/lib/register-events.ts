import C from "../constants.js";
import S from "../state.js";
import controlledRoot from "./controlled-root.js";

const A = C.attributes;
const SELECTOR = `[${A.action}], [${A.marker}]`;

/**
 * Runs the carousel for a clicked `data-carousel--action` or `data-carousel--marker` element
 */
const onClick = (event: Event) => {
	if (!(event.target instanceof Element)) return;
	const element = event.target.closest(SELECTOR);
	if (!element) return;
	const root = controlledRoot(element);
	if (root) S.instances.get(root)?.handle(element, event);
};

/**
 * Register the required event listeners
 * - The click listener lives on the document, so controls added after initialisation work without a refresh
 */
const registerEvents = () => {
	const { signal } = S.abortController;
	document.addEventListener("click", onClick, { signal });
};

export default registerEvents;
