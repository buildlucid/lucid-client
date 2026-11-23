import C from "../constants.js";
import type { Carousel } from "../types.js";
import { prefersReducedMotion } from "./autoplay.js";
import type { Context } from "./context.js";
import { clamp } from "./layout.js";
import { rescan } from "./markup.js";
import { go, step } from "./navigation.js";
import teardown from "./teardown.js";

const A = C.attributes;

/** Starts autoplay at the carousel's interval, or the default one for carousels without `data-carousel--autoplay` */
export const startAutoplay = (ctx: Context) =>
	ctx.autoplay.start(ctx.config.autoplay ?? C.autoplay);

const toggleAutoplay = (ctx: Context) => {
	if (ctx.autoplay.on) ctx.autoplay.stop();
	else startAutoplay(ctx);
};

/** Reads the markup again, and starts or stops autoplay when its option changed */
const refresh = (ctx: Context) => {
	const before = ctx.config.autoplay;
	rescan(ctx);
	const after = ctx.config.autoplay;

	if (before !== null && after === null) ctx.autoplay.stop();
	else if (before === null && after !== null && !prefersReducedMotion())
		startAutoplay(ctx);
	// A new interval applies straight away, unless autoplay was stopped.
	else if (after !== before && ctx.autoplay.on) startAutoplay(ctx);
};

/** Runs a clicked `data-carousel--action` or `data-carousel--marker` element */
export const handle = (ctx: Context, element: Element, event: Event) => {
	if (ctx.destroyed) return;
	if (element instanceof HTMLAnchorElement) event.preventDefault();

	const action = element.getAttribute(A.action);
	if (action !== null) {
		if (element.getAttribute("aria-disabled") === "true") return;
		switch (action) {
			case C.actions.prev:
				step(ctx, -1, "user");
				break;
			case C.actions.next:
				step(ctx, 1, "user");
				break;
			case C.actions.toggle:
				toggleAutoplay(ctx);
				break;
			case C.actions.play:
				startAutoplay(ctx);
				break;
			case C.actions.pause:
				ctx.autoplay.stop();
				break;
		}
		return;
	}

	const slide = ctx.markerSlides.get(element);
	if (slide === undefined || ctx.slides.length === 0) return;
	const target = clamp(slide, 0, ctx.slides.length - 1);
	const page = ctx.layout.slidePage[target];
	if (page !== undefined) go(ctx, page, "user", 0, target);
};

/** The public `Carousel` object. Its methods do nothing once the carousel is destroyed. */
export const createApi = (
	ctx: Context,
	onDestroy: (carousel: Carousel) => void,
): Carousel => {
	/** Wraps a method so it does nothing once the carousel is destroyed */
	const live =
		<Args extends unknown[]>(method: (...args: Args) => void) =>
		(...args: Args) => {
			if (!ctx.destroyed) method(...args);
		};

	const api: Carousel = {
		element: ctx.root,
		track: ctx.track,
		get state() {
			return { ...ctx.state };
		},
		next: live(() => step(ctx, 1, "user")),
		prev: live(() => step(ctx, -1, "user")),
		goTo: live((index: number) => go(ctx, index, "user")),
		play: live(() => startAutoplay(ctx)),
		pause: live(() => ctx.autoplay.stop()),
		toggle: live(() => toggleAutoplay(ctx)),
		subscribe: (listener) => {
			ctx.subscribers.add(listener);
			return () => {
				ctx.subscribers.delete(listener);
			};
		},
		refresh: live(() => refresh(ctx)),
		destroy: live(() => {
			teardown(ctx);
			onDestroy(api);
		}),
	};
	return api;
};
