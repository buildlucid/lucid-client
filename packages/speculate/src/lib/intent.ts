import C from "../constants.js";
import S from "../state.js";
import lib from "./index.js";

/**
 * Returns the link an event happened in, when it is one that's prefetched on intent
 * - The nearest link is found first, so a speculate attribute on markup inside a link doesn't hide the link itself
 */
const intentLink = (target: EventTarget | null): HTMLAnchorElement | null => {
	if (!(target instanceof Element)) return null;
	const link = target.closest("a");
	if (!(link instanceof HTMLAnchorElement) || !link.matches(C.selector)) {
		return null;
	}
	return lib.parseLink(link).trigger === "moderate" ? link : null;
};

/**
 * Cancels the prefetch of the link the pointer is resting on
 */
const cancel = () => {
	if (!S.hover) return;
	clearTimeout(S.hover.timer);
	S.hover = null;
};

/**
 * Starts the hover delay when the pointer moves onto a link
 * - Moving between elements inside the same link keeps the delay going
 * - The link is checked again once the delay ends, as it may have left the page or changed, and a removed link gets no `mouseout`
 */
const onMouseOver = (event: MouseEvent) => {
	const link = intentLink(event.target);
	if (!link || link === S.hover?.link) return;

	cancel();
	S.hover = {
		link,
		timer: setTimeout(() => {
			S.hover = null;
			if (link.isConnected && intentLink(link) === link) {
				lib.speculate([link]);
			}
		}, S.options.hoverDelay),
	};
};

/**
 * Cancels the hover delay when the pointer leaves the link before it ends
 */
const onMouseOut = (event: MouseEvent) => {
	const link = S.hover?.link;
	if (!link) return;
	if (
		event.relatedTarget instanceof Node &&
		link.contains(event.relatedTarget)
	) {
		return;
	}
	if (event.target instanceof Node && link.contains(event.target)) cancel();
};

/**
 * Prefetches a link straight away when it is pressed or focused
 */
const onPressOrFocus = (event: Event) => {
	const link = intentLink(event.target);
	if (!link) return;
	if (link === S.hover?.link) cancel();
	lib.speculate([link]);
};

/**
 * Prefetches `moderate` links on intent where Speculation Rules aren't supported, as browsers that support them do
 * - Resting the pointer on a link for `hoverDelay` prefetches it, and moving off it first cancels
 * - Pressing or focusing a link prefetches it straight away
 * - Listens on the document, so links added after `init` work without a refresh
 */
const register = () => {
	const options = { passive: true, signal: S.abortController.signal };
	document.addEventListener("mouseover", onMouseOver, options);
	document.addEventListener("mouseout", onMouseOut, options);
	document.addEventListener("pointerdown", onPressOrFocus, options);
	document.addEventListener("focusin", onPressOrFocus, options);
};

export default {
	register,
	cancel,
};
