import { type Context, warnOnce } from "./context.js";
import { clamp, type Layout, measureTrack, sizeKey } from "./layout.js";
import {
	applyRotation,
	clearRotation,
	loopFits,
	measureRotated,
	widestRotation,
} from "./loop.js";
import { renderGeneratedMarkers } from "./markers.js";
import { update } from "./render.js";
import {
	jump,
	position,
	resumeSnap,
	scrollTo,
	suspendSnap,
	targetPage,
} from "./scroll.js";

const measure = (ctx: Context, loop: boolean, snapSuspended: boolean) => {
	ctx.layout = measureTrack(
		ctx.track,
		ctx.slides,
		loop,
		ctx.layout,
		snapSuspended,
	);
	ctx.lastScroll = Number.NaN;
};

/**
 * Measures the track and decides whether looping fits. Only reads the page,
 * other than reordering the slides when they loop, so carousels starting
 * together can all measure before any of them writes.
 */
export const measureLayout = (ctx: Context) => {
	const { config, slides, track } = ctx;
	const canLoop =
		config.loop &&
		slides.length >= 3 &&
		/flex|grid/.test(getComputedStyle(track).display);
	const suspended = ctx.held.isHeld("scroll-snap-type");

	// Slides rotated for a loop that no longer applies, such as once loop is turned off, go back first.
	if (!canLoop && ctx.rotated) clearRotation(ctx);

	// Whether looping fits is planned before any slide is reordered, so a carousel that
	// rewinds instead never overrides the slides' own `order`.
	measure(ctx, canLoop, suspended);
	const looping = canLoop && ctx.layout.max > 1 && loopFits(ctx.layout);
	ctx.looping = looping;

	if (looping) {
		applyRotation(ctx, ctx.rotation);
		measure(ctx, true, suspended);
	} else {
		if (ctx.rotated) clearRotation(ctx);
		if (canLoop) measure(ctx, false, suspended);
	}

	if (config.loop && !looping && ctx.layout.max > 1)
		warnOnce(
			ctx,
			"Looping needs 3 or more slides in a flex or grid track, with room to scroll at least one slide, so this carousel rewinds at its ends instead.",
		);
};

/** Whether the track or a slide changed size between two layouts */
const resized = (before: Layout, after: Layout) =>
	before.client !== after.client ||
	before.boxes.length !== after.boxes.length ||
	before.boxes.some(
		(box, i) => Math.abs(box.size - (after.boxes[i]?.size ?? 0)) > 0.5,
	);

/**
 * Puts the slide the track last settled on back in place after a resize.
 * Chromium and Firefox snap back to it themselves, but WebKit snaps to
 * whichever slide is nearest when the resize clamps the scroll position.
 */
const restoreSnapped = (ctx: Context) => {
	const slide = ctx.snapped ? ctx.slides.indexOf(ctx.snapped) : -1;
	if (slide < 0 || ctx.drag?.dragging || ctx.touching) return;
	suspendSnap(ctx);
	if (ctx.looping) {
		applyRotation(ctx, widestRotation(ctx.layout, slide));
		measureRotated(ctx);
	}
	const { layout } = ctx;
	const page = layout.pages[layout.slidePage[slide] ?? -1];
	const to = clamp(page?.position ?? 0, 0, layout.max);
	if (Math.abs(to - position(ctx)) > 1) jump(ctx, to);
	resumeSnap(ctx, true);
};

/**
 * Writes what follows from a new layout: the generated markers, a scroll in
 * progress or, after a resize, the slide that was in view, and unless
 * `silent`, the state
 */
export const applyLayout = (
	ctx: Context,
	silent: boolean,
	wasResized = false,
) => {
	renderGeneratedMarkers(ctx);
	const { layout } = ctx;
	const page = targetPage(ctx);

	if (page !== null) {
		// A layout change mid-scroll can move the slide being scrolled to, so the scroll follows it.
		const to = clamp(layout.pages[page]?.position ?? 0, 0, layout.max);
		if (Math.abs(to - ctx.targetPosition) > 1) {
			ctx.targetPosition = to;
			scrollTo(ctx, to);
		}
	} else if (wasResized) restoreSnapped(ctx);

	if (!silent) update(ctx, true);
};

/**
 * Measures the track again, and keeps a navigation in progress heading for
 * its page. With `silent`, the state is left for the caller to update.
 */
export const remeasure = (ctx: Context, silent = false) => {
	cancelAnimationFrame(ctx.measureFrame);
	ctx.measureFrame = 0;
	if (ctx.destroyed) return;
	const before = ctx.layout;
	measureLayout(ctx);
	applyLayout(ctx, silent, resized(before, ctx.layout));
};

/**
 * Measures straight away when the track changed size since it was measured.
 * A browser snaps a resized track again, often before the `ResizeObserver`
 * runs, and that scroll would otherwise be read against the old layout.
 */
export const measureIfResized = (ctx: Context) => {
	const { layout, track } = ctx;
	const client = layout.vertical ? track.clientHeight : track.clientWidth;
	const size = layout.vertical ? track.scrollHeight : track.scrollWidth;
	if (client !== layout.client || Math.max(0, size - client) !== layout.max)
		remeasure(ctx, true);
};

/** A `ResizeObserver`, or one that does nothing in browsers without it */
export const createResizeObserver = (callback: ResizeObserverCallback) =>
	typeof ResizeObserver === "function"
		? new ResizeObserver(callback)
		: ({ observe() {}, disconnect() {} } as unknown as ResizeObserver);

/** Measures again in the next frame when the track or a slide changed size since it was last measured */
export const onResize = (ctx: Context, entries: ResizeObserverEntry[]) => {
	const changed = entries.some((entry) => {
		// Inline and block size are width and height in horizontal writing, whichever way the track scrolls.
		const box = entry.borderBoxSize?.[0];
		const size = box
			? sizeKey(box.inlineSize, box.blockSize)
			: sizeKey(entry.contentRect.width, entry.contentRect.height);
		const known = ctx.layout.sizes.get(entry.target);
		return known === undefined || known !== size;
	});
	if (!changed && entries.length > 0) return;
	if (!ctx.measureFrame)
		ctx.measureFrame = requestAnimationFrame(() => remeasure(ctx));
};
