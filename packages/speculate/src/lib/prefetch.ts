import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Prefetches a URL where Speculation Rules aren't supported
 * - Uses `<link rel="prefetch">` where it is supported, or else a low priority fetch
 * - Both only help when the page is sent with cache headers, as the navigation reads it from the HTTP cache
 * - The hash is left out, as it is never sent, so each page is only prefetched once
 */
const prefetch = (url: URL) => {
	const href = lib.withoutHash(url);
	if (S.requested.has(href)) return;
	S.requested.add(href);

	if (S.support.linkPrefetch) {
		const link = document.createElement("link");
		link.rel = "prefetch";
		link.as = "document";
		link.href = href;
		link.setAttribute(C.attributes.generated, "");
		document.head.append(link);
		return;
	}

	// A prefetch that fails, or is cancelled by destroy, only means the page loads as it would have.
	fetch(href, { priority: "low", signal: S.abortController.signal }).catch(
		() => {},
	);
};

export default prefetch;
