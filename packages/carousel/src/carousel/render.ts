import C from "../constants.js";
import format from "../lib/format.js";
import S from "../state.js";
import type { CarouselChange, CarouselState } from "../types.js";
import { isAutoplayAction } from "./autoplay.js";
import type { Context } from "./context.js";
import { type Box, clamp, nearestPage } from "./layout.js";
import { wraps } from "./loop.js";
import { position } from "./scroll.js";

const A = C.attributes;

// ----------------------------------------------------------------
// Working out the state

/** Whether at least half a slide is in view, or half the view for a slide bigger than it */
const isVisible = (box: Box | undefined, scroll: number, client: number) => {
	if (!box || box.size <= 0) return false;
	const overlap =
		Math.min(box.start + box.size, scroll + client) -
		Math.max(box.start, scroll);
	return overlap >= Math.min(box.size, client) / 2 - 0.5;
};

/**
 * Works out the state from the scroll position, and marks the slides in view
 * and on the current page. Runs on every scroll event, which browsers fire at
 * most once a frame, so it only writes to slides whose state changed.
 * `scroll` is passed when it was just measured, so reading it again doesn't
 * lay the page out.
 */
export const update = (ctx: Context, force = false, scroll = position(ctx)) => {
	// Some browsers fire scroll events without the position changing.
	if (!force && scroll === ctx.lastScroll) return;
	ctx.lastScroll = scroll;

	const { layout, looping, rec, slideFlags } = ctx;
	const { pages, boxes, slidePage, client, max } = layout;
	const index = nearestPage(layout, scroll);

	ctx.slides.forEach((slide, i) => {
		const visible = isVisible(boxes[i], scroll, client);
		const active = slidePage[i] === index;
		const flags = (visible ? 1 : 0) | (active ? 2 : 0);
		if (!force && slideFlags[i] === flags) return;
		slideFlags[i] = flags;
		rec.attr(slide, A.visible, visible ? "" : null);
		rec.attr(slide, A.active, active ? "" : null);
	});

	setState(
		ctx,
		{
			index,
			count: pages.length,
			// The ends are the first and last pages, which scroll-margin can keep short of the track's own ends.
			atStart: !looping && index === 0,
			atEnd: !looping && index >= pages.length - 1,
			scrollable: max > 1 && pages.length > 1,
			playing: ctx.autoplay.on,
		},
		force,
	);
};

/**
 * Stores a new state. When it changed, writes it to the markup, tells the
 * subscribers and, once the carousel has started, dispatches `carousel-change`
 * for a new page. `force` writes it to the markup even when it didn't change.
 */
export const setState = (ctx: Context, next: CarouselState, force = false) => {
	if (ctx.destroyed) return;
	const previous = ctx.state;
	const changed = (Object.keys(next) as Array<keyof CarouselState>).some(
		(key) => next[key] !== previous[key],
	);
	ctx.state = next;
	if (changed || force) render(ctx);
	if (!changed) return;

	for (const listener of ctx.subscribers) {
		listener({ ...ctx.state });
		// A listener may destroy the carousel.
		if (ctx.destroyed) return;
	}

	if (ctx.started && next.index !== previous.index) {
		ctx.root.dispatchEvent(
			new CustomEvent<CarouselChange>(C.events.change, {
				bubbles: true,
				detail: {
					index: next.index,
					previousIndex: previous.index,
					count: next.count,
				},
			}),
		);
	}
};

// ----------------------------------------------------------------
// Writing the state

const render = (ctx: Context) => {
	renderRoot(ctx);
	// A custom property restyles the whole carousel, so they wait for the track to stop.
	if (!ctx.scrolling) writeProperties(ctx);
	renderControls(ctx);
	renderCurrentMarkers(ctx);
};

const renderRoot = ({ rec, root, state }: Context) => {
	rec.attr(root, A.ready, "");
	rec.attr(root, A.index, String(state.index));
	rec.attr(root, A.count, String(state.count));
	rec.attr(root, A.atStart, state.atStart ? "" : null);
	rec.attr(root, A.atEnd, state.atEnd ? "" : null);
	rec.attr(root, A.scrollable, state.scrollable ? "" : null);
	rec.attr(root, A.playing, state.playing ? "" : null);
};

/** Writes the index and count CSS variables */
export const writeProperties = ({ rec, root, state }: Context) => {
	rec.style(root, C.properties.index, String(state.index));
	rec.style(root, C.properties.count, String(state.count));
};

/** Whether a control has a name of its own, rather than one the library gave it */
const hasOwnName = (ctx: Context, element: Element) =>
	(element.textContent ?? "").trim() !== "" ||
	element.hasAttribute("aria-labelledby") ||
	(element.hasAttribute("aria-label") && !ctx.rec.added(element, "aria-label"));

/** Disables `prev` and `next` at the ends, and labels icon-only autoplay controls */
const renderControls = (ctx: Context) => {
	const { rec, state } = ctx;
	const wrapping = ctx.looping || wraps(ctx);
	const canPrev = state.scrollable && (wrapping || !state.atStart);
	const canNext = state.scrollable && (wrapping || !state.atEnd);

	for (const control of ctx.controls) {
		const action = control.getAttribute(A.action);
		if (action === C.actions.prev || action === C.actions.next) {
			const enabled = action === C.actions.prev ? canPrev : canNext;
			rec.attr(control, "aria-disabled", enabled ? null : "true");
			continue;
		}

		// A control changed to another action loses what the library wrote for the old one.
		if (rec.added(control, "aria-disabled"))
			rec.attr(control, "aria-disabled", null);
		if (!isAutoplayAction(action)) {
			if (rec.added(control, "aria-label"))
				rec.attr(control, "aria-label", null);
			continue;
		}

		if (hasOwnName(ctx, control)) continue;
		const playing =
			action === C.actions.toggle ? state.playing : action === C.actions.pause;
		rec.attr(control, "aria-label", playing ? S.labels.pause : S.labels.play);
	}
};

/** Marks the markers for the current page with `aria-current` */
const renderCurrentMarkers = (ctx: Context) => {
	const { layout, markerSlides, rec, slides, state } = ctx;
	for (const marker of ctx.markers) {
		const slide = markerSlides.get(marker);
		const page =
			slide === undefined
				? undefined
				: layout.slidePage[clamp(slide, 0, slides.length - 1)];
		const current = page !== undefined && page === state.index;
		rec.attr(marker, "aria-current", current ? "true" : null);
	}
};

// ----------------------------------------------------------------
// Once the track stops

/** Writes the status after a visitor moves the carousel, but not for autoplay or on load */
export const announce = (ctx: Context) => {
	const { state, statusNodes } = ctx;
	if (state.index === ctx.announced) return;
	ctx.announced = state.index;
	if (ctx.fromAutoplay || state.count === 0) return;

	const text = format(S.labels.status, state.index + 1, state.count);
	for (const status of ctx.statuses) {
		if (!statusNodes.has(status))
			statusNodes.set(status, Array.from(status.childNodes));
		status.textContent = text;
	}
};

/** With `data-carousel--inert`, makes slides out of view inert, except one holding focus */
export const applyInert = (ctx: Context) => {
	const { config, rec } = ctx;
	// Without the option, the slides are only visited once more after it is turned off, to take back what it added.
	if (!config.inert && !ctx.inertApplied) return;
	ctx.inertApplied = config.inert;

	const focused = document.activeElement;
	for (const slide of ctx.slides) {
		const added = rec.added(slide, "inert");
		// Inert the markup set itself is left alone.
		if (slide.hasAttribute("inert") && !added) continue;
		if (!config.inert && !added) continue;
		const hide =
			config.inert &&
			!slide.hasAttribute(A.visible) &&
			!(focused && slide.contains(focused));
		rec.attr(slide, "inert", hide ? "" : null);
	}
};
