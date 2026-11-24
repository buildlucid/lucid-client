import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Sets up every link on the page
 * - `visible` links are observed, and speculated once they scroll into view
 * - With Speculation Rules, other links are added to a rule set straight away, and the browser waits for their trigger
 * - Without them, other links are prefetched on intent, which `intent` handles for the whole page
 * - A new observer replaces the last one, so `visible` links that left the page are no longer watched
 * - Links already speculated are skipped when the rules or prefetches are added, so running it again only adds what's new
 */
const scan = () => {
	S.observer?.disconnect();
	S.observer = lib.createObserver();
	const links: HTMLAnchorElement[] = [];

	for (const element of document.querySelectorAll(C.selector)) {
		if (!(element instanceof HTMLAnchorElement)) {
			if (__DEV__) {
				lib.log(
					"warn",
					`Speculate attributes only work on links, but one was found on a <${element.localName}>.`,
				);
			}
			continue;
		}
		if (lib.linkUrl(element) === null) continue;

		if (lib.parseLink(element).trigger === "visible") {
			S.observer.observe(element);
		} else if (S.support.rules) {
			links.push(element);
		}
	}

	lib.speculate(links);
};

export default scan;
