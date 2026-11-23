import C from "../constants.js";
import { isAutoplayAction } from "./autoplay.js";
import type { Context } from "./context.js";
import { measurePending } from "./measure.js";
import { applyInert, update } from "./render.js";
import { interrupt, settle, waitForSettle } from "./settle.js";

const A = C.attributes;

/** Whether an event started on a toggle, play or pause control, which handles autoplay itself */
const onAutoplayControl = (event: Event) => {
	const control =
		event.target instanceof Element
			? event.target.closest(`[${A.action}]`)
			: null;
	return control !== null && isAutoplayAction(control.getAttribute(A.action));
};

/**
 * Follows a visitor hovering, focusing, scrolling, touching, pressing and
 * using the wheel, until the carousel is destroyed. Clicks on controls and
 * markers are handled on the document, for every carousel at once.
 */
const registerListeners = (ctx: Context) => {
	const { autoplay, root, track } = ctx;
	const { signal } = ctx.abort;

	// ----------------------------------------------------------------
	// Autoplay and focus

	root.addEventListener(
		"pointerenter",
		(event) => {
			if (event.pointerType === "mouse") autoplay.hold("hover");
		},
		{ signal },
	);
	root.addEventListener(
		"pointerleave",
		(event) => {
			if (event.pointerType === "mouse") autoplay.release("hover");
		},
		{ signal },
	);

	// Keyboard focus moving into the carousel, including onto its toggle, stops autoplay until it is started again.
	// Focus moved by a press is left to the press, so clicking the toggle toggles it.
	let pressing = false;
	root.addEventListener(
		"pointerdown",
		() => {
			pressing = true;
			setTimeout(() => {
				pressing = false;
			}, 0);
		},
		{ capture: true, signal },
	);
	root.addEventListener(
		"focusin",
		() => {
			if (!pressing) autoplay.stop();
		},
		{ signal },
	);

	// A slide spared from inert because it held focus is made inert once focus moves elsewhere.
	track.addEventListener(
		"focusout",
		() => {
			if (ctx.config.inert)
				setTimeout(() => !ctx.destroyed && applyInert(ctx), 0);
		},
		{ signal },
	);

	// ----------------------------------------------------------------
	// Scrolling

	track.addEventListener(
		"scroll",
		() => {
			ctx.scrolling = true;
			waitForSettle(ctx);
			measurePending(ctx);
			update(ctx);
		},
		{ passive: true, signal },
	);
	track.addEventListener(
		"scrollend",
		() => {
			measurePending(ctx);
			settle(ctx, false);
		},
		{ signal },
	);

	// ----------------------------------------------------------------
	// A visitor taking over

	track.addEventListener(
		"touchstart",
		(event) => {
			ctx.touching = true;
			if (!onAutoplayControl(event)) interrupt(ctx);
		},
		{ passive: true, signal },
	);
	const endTouch = () => {
		ctx.touching = false;
		waitForSettle(ctx);
	};
	track.addEventListener("touchend", endTouch, { passive: true, signal });
	track.addEventListener("touchcancel", endTouch, { passive: true, signal });

	track.addEventListener(
		"pointerdown",
		(event) => {
			if (event.pointerType === "touch") return;
			// A press on a play control inside the track is left to its click.
			if (!onAutoplayControl(event)) interrupt(ctx);
		},
		{ signal },
	);

	// A wheel along the scroll axis scrolls the track, so the visitor has taken over.
	track.addEventListener(
		"wheel",
		(event) => {
			const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
			if (horizontal !== ctx.layout.vertical) interrupt(ctx);
		},
		{ passive: true, signal },
	);
};

export default registerListeners;
