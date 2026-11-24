import S from "../state.js";
import type { Speculation } from "../types.js";
import lib from "./index.js";

/**
 * Speculates links
 * - With Speculation Rules, the links are added to one new rule set
 * - Without them, each link is prefetched straight away
 * - Links are read again each time, so a link whose `href` or attributes changed is speculated as it is now
 */
const speculate = (links: HTMLAnchorElement[]) => {
	const speculations: Speculation[] = [];
	for (const link of links) {
		const url = lib.linkUrl(link);
		if (url) speculations.push({ ...lib.parseLink(link), url });
	}

	if (S.support.rules) lib.rules(speculations);
	else for (const { url } of speculations) lib.prefetch(url);
};

export default speculate;
