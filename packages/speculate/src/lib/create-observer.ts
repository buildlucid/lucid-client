import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Returns whether a link is still on the page and still asks to be speculated when visible
 */
const stillVisibleLink = (link: HTMLAnchorElement) =>
	link.isConnected &&
	link.matches(C.selector) &&
	lib.parseLink(link).trigger === "visible";

/**
 * Creates the observer that speculates `visible` links once they scroll into view
 * - Links that come into view together are speculated together, so they share one rule set
 * - An observer that a refresh or destroy has replaced ignores the entries it had already queued, so links that left the page aren't speculated
 * - A link that changed since it was observed, such as by losing its speculate attribute, is let go of
 */
const createObserver = () => {
	const observer = new IntersectionObserver((entries) => {
		if (observer !== S.observer) return;

		const links: HTMLAnchorElement[] = [];
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			if (!(entry.target instanceof HTMLAnchorElement)) continue;
			observer.unobserve(entry.target);
			if (stillVisibleLink(entry.target)) links.push(entry.target);
		}
		lib.speculate(links);
	});
	return observer;
};

export default createObserver;
