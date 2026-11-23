import type { Context, Source } from "./context.js";
import { clamp } from "./layout.js";
import {
	applyRotation,
	measureRotated,
	reach,
	shortestWay,
	widestRotation,
	wraps,
} from "./loop.js";
import { update } from "./render.js";
import { jump, position, scrollTo, suspendSnap, targetPage } from "./scroll.js";
import { settle, waitForSettle } from "./settle.js";

/**
 * Scrolls to a page. `slide` is the slide being asked for, such as a marker's,
 * which the scroll keeps heading for if the pages change.
 * - `direction` is the way to travel while looping, as 1 or -1, or 0 for the shortest way round
 */
export const go = (
	ctx: Context,
	page: number,
	source: Source,
	direction = 0,
	slide?: number,
) => {
	const count = ctx.layout.pages.length;
	if (ctx.destroyed || count === 0 || !ctx.state.scrollable) return;
	if (source === "user") ctx.autoplay.stop();
	// A listener may destroy the carousel when autoplay stops.
	if (ctx.destroyed) return;
	ctx.fromAutoplay = source === "auto";

	const target = ctx.looping
		? ((page % count) + count) % count
		: clamp(Math.round(page), 0, count - 1);
	if (ctx.looping && !prepareLoop(ctx, target, direction, count)) return;

	const { layout } = ctx;
	const to = clamp(layout.pages[target]?.position ?? 0, 0, layout.max);
	const moving = ctx.targetSlide !== null;
	// The slide asked for, when it is on the target page, or else the page's own slide
	const targetSlide =
		slide !== undefined && layout.slidePage[slide] === target
			? slide
			: layout.pages[target]?.slide;
	ctx.targetSlide = ctx.slides[targetSlide ?? -1] ?? null;
	ctx.targetPosition = to;

	suspendSnap(ctx);
	if (Math.abs(to - position(ctx)) < 1) {
		// A scroll still heading elsewhere is replaced by one that stays here.
		if (moving) scrollTo(ctx, to);
		settle(ctx, true);
		return;
	}
	scrollTo(ctx, to);
	waitForSettle(ctx);
};

/** Moves one page forward or back. The ends wrap while looping or rewinding, and for autoplay. */
export const step = (ctx: Context, direction: 1 | -1, source: Source) => {
	const count = ctx.layout.pages.length;
	if (count === 0) return;

	let target = (targetPage(ctx) ?? ctx.state.index) + direction;
	if (!ctx.looping && (target < 0 || target >= count)) {
		if (!wraps(ctx) && source !== "auto") return;
		target = direction > 0 ? 0 : count - 1;
	}
	go(ctx, target, source, ctx.looping ? direction : 0);
};

/**
 * While looping, rotates the slides so the target page can be scrolled to.
 * Returns `false` when it jumped straight there instead, or the carousel was
 * destroyed, so there is nothing left to scroll.
 */
const prepareLoop = (
	ctx: Context,
	target: number,
	direction: number,
	count: number,
) => {
	const from = targetPage(ctx);
	const way = direction || shortestWay(from ?? ctx.state.index, target, count);
	if (reach(ctx, target, way)) return true;

	// When the slides can't be rotated to reach it from mid-scroll, the scroll in progress finishes first.
	if (from !== null) {
		const current = ctx.layout.pages[from]?.position;
		if (current !== undefined) jump(ctx, clamp(current, 0, ctx.layout.max));
		update(ctx);
		if (ctx.destroyed) return false;
		if (reach(ctx, target, way)) return true;
	}

	teleport(ctx, target);
	return false;
};

/**
 * Lays the slides out so a page has room on both sides and jumps straight to
 * it, for a page that can't be scrolled to, such as a marker two pages away on
 * a track that can only scroll one
 */
const teleport = (ctx: Context, target: number) => {
	const slide = ctx.layout.pages[target]?.slide;
	if (slide === undefined) return;

	const rotation = widestRotation(ctx.layout, slide);
	suspendSnap(ctx);
	applyRotation(ctx, rotation);
	measureRotated(ctx);
	ctx.targetSlide = null;

	const { layout } = ctx;
	jump(ctx, clamp(layout.pages[target]?.position ?? 0, 0, layout.max));
	settle(ctx, true);
};
