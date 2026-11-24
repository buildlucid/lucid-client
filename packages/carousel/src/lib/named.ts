/** Whether a text node sits inside an `aria-hidden` element within `root`, so it isn't part of the name */
const hiddenWithin = (root: Element, node: Node) => {
	const hidden = node.parentElement?.closest('[aria-hidden="true"]');
	return hidden !== null && hidden !== undefined && root.contains(hidden);
};

/**
 * Whether an element has a name of its own for assistive technology: text
 * outside `aria-hidden` elements, an image's alt text, `aria-labelledby`,
 * `title` or, unless `label` is `false`, `aria-label`
 * - `label` is `false` for an `aria-label` the library gave it, which doesn't count as the element's own
 */
const named = (element: Element, label = true) => {
	if (
		(label && element.hasAttribute("aria-label")) ||
		element.hasAttribute("aria-labelledby") ||
		element.hasAttribute("title") ||
		element.querySelector('img[alt]:not([alt=""])') !== null
	)
		return true;
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode())
		if (node.nodeValue?.trim() && !hiddenWithin(element, node)) return true;
	return false;
};

export default named;
