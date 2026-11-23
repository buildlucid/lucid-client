import C from "../constants.js";
import type { Context } from "./context.js";
import { clamp } from "./layout.js";
import { centreCurrent } from "./loop.js";
import { announce, applyInert, update, writeProperties } from "./render.js";
import { position, resumeSnap, targetPage } from "./scroll.js";

/**
 * Settles the track once it has been still for the settle delay. Scroll
 * events only note the time, so a scroll doesn't reset a timer every frame.
 */
export const waitForSettle = (ctx: Context) => {
	ctx.lastScrollAt = performance.now();
	if (ctx.settleTimer !== undefined) return;

	const check = () => {
		const still = performance.now() - ctx.lastScrollAt;
		if (still >= C.settleDelay) {
			ctx.settleTimer = undefined;
			settle(ctx, true);
		} else ctx.settleTimer = setTimeout(check, C.settleDelay - still);
	};
	ctx.settleTimer = setTimeout(check, C.settleDelay);
};

/** Remembers the slide on the current page, so a resize can put it back */
export const rememberSnapped = (ctx: Context) => {
	const slide = ctx.layout.pages[ctx.state.index]?.slide;
	ctx.snapped = ctx.slides[slide ?? -1] ?? null;
};

/** Whether a navigation in progress is still short of its page */
const stillHeading = (ctx: Context) => {
	const page = targetPage(ctx);
	if (page === null) return false;
	const to = ctx.layout.pages[page]?.position;
	if (to === undefined) return false;
	return Math.abs(position(ctx) - clamp(to, 0, ctx.layout.max)) > 1;
};

/**
 * Runs once the track stops moving: finishes a navigation, rotates the slides
 * while looping, turns snapping back on and announces the new page
 * - `scrollend` can fire early, such as after a loop rotation's jump, so
 *   without `force` it waits while a navigation hasn't arrived yet
 */
export const settle = (ctx: Context, force: boolean) => {
	clearTimeout(ctx.settleTimer);
	ctx.settleTimer = undefined;
	if (ctx.destroyed || ctx.drag?.dragging || ctx.touching) return;
	if (!force && stillHeading(ctx)) {
		waitForSettle(ctx);
		return;
	}

	ctx.targetSlide = null;
	update(ctx);
	if (ctx.destroyed) return;

	let recentred = false;
	if (ctx.looping) {
		recentred = centreCurrent(ctx) !== 0;
		if (recentred) update(ctx);
	}
	resumeSnap(ctx);

	ctx.scrolling = false;
	rememberSnapped(ctx);
	writeProperties(ctx);
	announce(ctx);
	applyInert(ctx);
	ctx.fromAutoplay = false;
};

/** A visitor took over: stops autoplay and any navigation in progress */
export const interrupt = (ctx: Context) => {
	ctx.autoplay.stop();
	if (ctx.targetSlide === null) return;
	ctx.targetSlide = null;
	ctx.fromAutoplay = false;
	resumeSnap(ctx);
};
