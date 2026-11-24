import C from "../constants.js";
import log from "../lib/log.js";
import owned from "../lib/owned.js";
import { emptyState, type Instance } from "../state.js";
import type { Carousel } from "../types.js";
import { createApi, handle, startAutoplay } from "./api.js";
import createAutoplay, { prefersReducedMotion } from "./autoplay.js";
import type { Context, Operated } from "./context.js";
import { emptyLayout } from "./layout.js";
import registerListeners from "./listeners.js";
import { centreCurrent } from "./loop.js";
import {
	checkControls,
	readConfig,
	readMarkup,
	rescan,
	resetMarkup,
} from "./markup.js";
import { applyLayout, measureLayout, onResize } from "./measure.js";
import { step } from "./navigation.js";
import createRecorder from "./recorder.js";
import { applyInert, setState, update } from "./render.js";
import { createHeldStyles, resumeSnap } from "./scroll.js";
import { rememberSnapped } from "./settle.js";
import teardown from "./teardown.js";

const createContext = (root: HTMLElement, track: HTMLElement): Context => {
	const ctx: Context = {
		root,
		track,
		trackStyle: track.getAttribute("style"),
		abort: new AbortController(),
		rec: createRecorder(),
		held: createHeldStyles(track),
		autoplay: createAutoplay(
			root,
			() => step(ctx, 1, "auto"),
			() => setState(ctx, { ...ctx.state, playing: ctx.autoplay.on }),
		),
		drag: null,
		resize: new ResizeObserver((entries) => onResize(ctx, entries)),
		mutation: new MutationObserver(() => {
			if (!ctx.destroyed) rescan(ctx);
		}),
		subscribers: new Set(),

		config: readConfig(root),
		slides: [],
		controls: [],
		markers: [],
		markerSlides: new Map(),
		generated: new Map(),
		statuses: [],
		statusNodes: new Map(),

		layout: emptyLayout(),
		looping: false,
		rotation: 0,
		rotated: false,

		state: emptyState(),
		slideFlags: [],
		announced: 0,
		started: false,
		destroyed: false,
		warnings: new Set(),

		targetSlide: null,
		targetPosition: 0,
		snapped: null,
		fromAutoplay: false,
		scrolling: false,
		touching: false,
		lastScroll: 0,
		lastScrollAt: 0,

		settleTimer: undefined,
		measureFrame: 0,
	};
	ctx.mutation.observe(track, { childList: true });
	return ctx;
};

/**
 * The last phase of starting: writes the state from the layout every
 * carousel starting together has measured, then starts autoplay
 */
const start = (ctx: Context) => {
	if (ctx.destroyed) return;
	applyLayout(ctx, true);
	update(ctx, true, ctx.layout.scroll);
	applyInert(ctx);
	checkControls(ctx);

	if (ctx.looping && centreCurrent(ctx) !== 0) {
		update(ctx);
		resumeSnap(ctx);
	}

	ctx.announced = ctx.state.index;
	rememberSnapped(ctx);
	if (ctx.config.autoplay !== null && !prefersReducedMotion())
		startAutoplay(ctx);
	ctx.started = true;
};

/**
 * Enhances one `data-carousel` element. Returns `null` when it has no track.
 * - `operated` is passed when its controls and markers were already found, for carousels starting together
 *
 * Carousels start in three phases, each run for every carousel on the page
 * before the next, so the page is laid out once: this writes their attributes,
 * then `measure` measures them and `start` writes their state.
 */
const createCarousel = (
	root: HTMLElement,
	onDestroy: (carousel: Carousel) => void,
	operated?: Operated,
): Instance | null => {
	const track = owned(root, `[${C.attributes.track}]`)[0];
	if (!track) {
		if (__DEV__)
			log(
				"warn",
				"A data-carousel element has no data-carousel--track element, so it was skipped.",
			);
		return null;
	}

	const ctx = createContext(root, track);
	registerListeners(ctx);
	const api = createApi(ctx, onDestroy);
	readMarkup(ctx, operated);

	return {
		api,
		handle: (element, event) => handle(ctx, element, event),
		teardown: () => teardown(ctx),
		reset: () => resetMarkup(ctx),
		measure: () => {
			if (!ctx.destroyed) measureLayout(ctx);
		},
		start: () => start(ctx),
	};
};

export default createCarousel;
