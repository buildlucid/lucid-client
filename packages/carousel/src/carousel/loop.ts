import type { Context } from "./context.js";
import { clamp, type Layout, measureTrack, snapPosition } from "./layout.js";
import { jump, physicalScroll, position, suspendSnap } from "./scroll.js";

/**
 * Looping reorders the slides with CSS `order` rather than cloning them. A
 * rotation is the slide laid out first. Once the track stops, the slides are
 * rotated so the current one has room on both sides, and the track jumps so
 * nothing moves on screen.
 */

// ----------------------------------------------------------------
// Planning

/**
 * Where each slide would start if the slides were laid out from `rotation`,
 * using the sizes, margins and gap measured now
 */
const plannedStarts = (layout: Layout, rotation: number) => {
	const count = layout.boxes.length;
	const starts: number[] = Array.from({ length: count }, () => 0);
	let cursor = layout.origin;
	for (let offset = 0; offset < count; offset++) {
		const slide = (rotation + offset) % count;
		const [before, after] = layout.outer[slide] ?? [0, 0];
		cursor += before;
		starts[slide] = cursor;
		cursor += (layout.boxes[slide]?.size ?? 0) + after + layout.gap;
	}
	return starts;
};

/** How far the track could scroll either way from a snap position */
const roomAround = (layout: Layout, snap: number) =>
	Math.min(snap, layout.max - snap);

/** How much room a slide would have on both sides with the slides laid out from `rotation` */
const roomFor = (layout: Layout, slide: number, rotation: number) => {
	const start = plannedStarts(layout, rotation)[slide] ?? 0;
	return roomAround(layout, snapPosition(layout, slide, start));
};

/** Whether the track can scroll to a position, allowing for rounding */
const reachable = (layout: Layout, scroll: number) =>
	scroll >= -1 && scroll <= layout.max + 1;

/**
 * The rotation that gives a slide the most room on both sides. It stays with
 * `current` unless another rotation is clearly better, and `current` is
 * planned too, rather than measured, so uneven gaps can't make it rotate back
 * and forth.
 */
const centredRotation = (layout: Layout, current: number, slide: number) => {
	let best = current;
	let bestRoom = roomFor(layout, slide, current);
	for (let rotation = 0; rotation < layout.boxes.length; rotation++) {
		if (rotation === current) continue;
		const room = roomFor(layout, slide, rotation);
		if (room > bestRoom + 1) {
			best = rotation;
			bestRoom = room;
		}
	}
	return best;
};

/** The rotation that gives a slide the most room on both sides, for jumping straight to it */
export const widestRotation = (layout: Layout, slide: number) => {
	let best = 0;
	let bestRoom = Number.NEGATIVE_INFINITY;
	for (let rotation = 0; rotation < layout.boxes.length; rotation++) {
		const room = roomFor(layout, slide, rotation);
		if (room > bestRoom + 0.5) {
			best = rotation;
			bestRoom = room;
		}
	}
	return best;
};

/**
 * The rotation that lets the track scroll from the slide in view, `anchor`, to
 * `slide` in the direction of travel. Returns `current` when it already can,
 * and -1 when no rotation can.
 * - `offset` is how far `anchor` starts from the scroll position, which stays the same on screen
 * - `direction` is 1 or -1, or 0 for either way
 */
const rotationToReach = (
	layout: Layout,
	current: number,
	{
		slide,
		anchor,
		offset,
		direction,
	}: { slide: number; anchor: number; offset: number; direction: number },
) => {
	const fits = (starts: number[]) => {
		const scroll = (starts[anchor] ?? 0) - offset;
		if (!reachable(layout, scroll)) return false;
		const snap = snapPosition(layout, slide, starts[slide] ?? 0);
		if (!reachable(layout, snap)) return false;
		return (
			direction === 0 ||
			slide === anchor ||
			Math.sign(snap - scroll) === direction
		);
	};
	if (fits(layout.boxes.map((box) => box.start))) return current;

	let best = -1;
	let bestRoom = Number.NEGATIVE_INFINITY;
	for (let rotation = 0; rotation < layout.boxes.length; rotation++) {
		if (rotation === current) continue;
		const starts = plannedStarts(layout, rotation);
		if (!fits(starts)) continue;
		const room = roomAround(
			layout,
			snapPosition(layout, slide, starts[slide] ?? 0),
		);
		if (room > bestRoom) {
			best = rotation;
			bestRoom = room;
		}
	}
	return best;
};

/**
 * Whether looping can always move one page either way: for every pair of
 * neighbouring pages, some rotation must put both within reach, in order.
 * Needs a layout measured for looping.
 */
export const loopFits = (layout: Layout) => {
	const { pages } = layout;
	const count = pages.length;
	if (count < 3) return false;

	const fits = Array.from({ length: count }, () => false);
	const rotations = layout.boxes.length;
	let left = count;
	for (let rotation = 0; rotation < rotations && left > 0; rotation++) {
		const starts = plannedStarts(layout, rotation);
		const snaps = pages.map((page) =>
			snapPosition(layout, page.slide, starts[page.slide] ?? 0),
		);
		for (let page = 0; page < count; page++) {
			if (fits[page]) continue;
			const from = snaps[page] ?? 0;
			const to = snaps[(page + 1) % count] ?? 0;
			if (reachable(layout, from) && reachable(layout, to) && to > from) {
				fits[page] = true;
				left--;
			}
		}
	}
	return left === 0;
};

/** The shortest way round from one page to another, as -1, 0 or 1 */
export const shortestWay = (from: number, to: number, count: number) => {
	const forward = (((to - from) % count) + count) % count;
	if (forward === 0) return 0;
	return forward <= count / 2 ? 1 : -1;
};

/** Whether the ends wrap: with rewind, or when looping was asked for but there isn't room for it */
export const wraps = (ctx: Context) =>
	ctx.config.rewind || (ctx.config.loop && !ctx.looping);

// ----------------------------------------------------------------
// Rotating

/** Lays the slides out from another slide, with CSS `order` */
export const applyRotation = (ctx: Context, rotation: number) => {
	const { rec, slides } = ctx;
	const count = slides.length;
	const first = ((rotation % count) + count) % count;
	ctx.rotation = first;
	ctx.rotated = true;
	slides.forEach((slide, i) => {
		rec.style(slide, "order", String((i - first + count) % count));
	});
};

/** Puts each slide's own `order` back */
export const clearRotation = (ctx: Context) => {
	const { rec, slides } = ctx;
	ctx.rotation = 0;
	ctx.rotated = false;
	for (const slide of slides) rec.reset(slide, "order");
};

/** Measures the track again once the slides were rotated, with snapping suspended */
export const measureRotated = (ctx: Context) => {
	ctx.layout = measureTrack(ctx.track, ctx.slides, true, ctx.layout, true);
	ctx.lastScroll = Number.NaN;
};

/**
 * Lays the slides out from another slide, then scrolls so `anchor` stays
 * exactly where it was on screen. Returns how far `scrollLeft` or `scrollTop`
 * moved.
 */
const rotate = (ctx: Context, rotation: number, anchor: number) => {
	const box = ctx.layout.boxes[anchor];
	if (!box || rotation === ctx.rotation) return 0;

	const offset = box.start - position(ctx);
	const before = physicalScroll(ctx);
	suspendSnap(ctx);
	applyRotation(ctx, rotation);
	measureRotated(ctx);

	const start = ctx.layout.boxes[anchor]?.start ?? 0;
	jump(ctx, clamp(start - offset, 0, ctx.layout.max));
	return physicalScroll(ctx) - before;
};

/**
 * Rotates the slides so `anchor` has as much room as possible on both sides,
 * which is what lets the carousel keep going in either direction. Returns how
 * far `scrollLeft` or `scrollTop` moved.
 */
export const centre = (ctx: Context, anchor: number) =>
	rotate(ctx, centredRotation(ctx.layout, ctx.rotation, anchor), anchor);

/** Centres the slides on the current page */
export const centreCurrent = (ctx: Context) => {
	const anchor = ctx.layout.pages[ctx.state.index]?.slide;
	return anchor === undefined ? 0 : centre(ctx, anchor);
};

/**
 * Before scrolling to a page while looping, rotates the slides if the page
 * can't be reached in the direction of travel from where the track is now.
 * Returns `false` when no rotation can reach it.
 */
export const reach = (ctx: Context, target: number, direction: number) => {
	const { layout } = ctx;
	const slide = layout.pages[target]?.slide;
	const anchor = layout.pages[ctx.state.index]?.slide;
	if (slide === undefined || anchor === undefined) return false;
	const anchorBox = layout.boxes[anchor];
	if (!anchorBox) return false;

	const rotation = rotationToReach(layout, ctx.rotation, {
		slide,
		anchor,
		offset: anchorBox.start - position(ctx),
		direction,
	});
	if (rotation < 0) return false;
	rotate(ctx, rotation, anchor);
	return true;
};
