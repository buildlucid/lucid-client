import log from "../lib/log.js";
import type { CarouselState } from "../types.js";
import type { Autoplay } from "./autoplay.js";
import type { Drag } from "./drag.js";
import type { Layout } from "./layout.js";
import type { Recorder } from "./recorder.js";
import type { HeldStyles } from "./scroll.js";

/** The options read from the `data-carousel` element */
export type Config = {
	loop: boolean;
	rewind: boolean;
	drag: boolean;
	inert: boolean;
	/** Milliseconds between slides, or `null` without autoplay */
	autoplay: number | null;
};

/** What moved the carousel: a visitor, through a control, marker, drag or the API, or autoplay */
export type Source = "user" | "auto";

/** The controls and markers that operate a carousel, in page order */
export type Operated = { controls: HTMLElement[]; markers: HTMLElement[] };

/** The markers generated for one markers container, and the pages and template they were made from */
type GeneratedMarkers = { key: string; markers: HTMLElement[] };

/**
 * Everything one carousel keeps track of. `createCarousel` makes it, and the
 * other modules in this folder take it as their first argument.
 */
export type Context = {
	// What lasts as long as the carousel

	root: HTMLElement;
	track: HTMLElement;
	/** The track's `style` attribute before the library ran, so destroy can remove an empty one */
	trackStyle: string | null;
	/** Removes every event listener once the carousel is destroyed */
	abort: AbortController;
	/** Every attribute and style the library writes, so destroy can put them back */
	rec: Recorder;
	/** Styles held on the track for a moment, such as snapping turned off while the library scrolls it */
	held: HeldStyles;
	autoplay: Autoplay;
	/** Mouse dragging, set up the first time `data-carousel--drag` turns it on */
	drag: Drag | null;
	resize: ResizeObserver;
	mutation: MutationObserver;
	/** The listeners added with `subscribe` */
	subscribers: Set<(state: CarouselState) => void>;

	// What the markup holds

	config: Config;
	slides: HTMLElement[];
	controls: HTMLElement[];
	/** Every marker: the author's own, then the generated ones */
	markers: HTMLElement[];
	/** The slide each marker scrolls to */
	markerSlides: Map<Element, number>;
	generated: Map<HTMLElement, GeneratedMarkers>;
	statuses: HTMLElement[];
	/** Each status element's content before it first announced, so destroy can put it back */
	statusNodes: Map<HTMLElement, Node[]>;

	// Layout

	layout: Layout;
	/** Whether the slides loop. Needs 3 or more slides that overflow a flex or grid track. */
	looping: boolean;
	/** The slide laid out first while looping */
	rotation: number;
	/** Whether slides have an `order` from looping, so it is only cleared when the library set it */
	rotated: boolean;

	// State

	state: CarouselState;
	/** Each slide's visible and active state as last written, so a scroll only writes what changed */
	slideFlags: number[];
	/** The page the status elements last announced */
	announced: number;
	/** Whether `data-carousel--inert` applied when the slides were last made inert */
	inertApplied: boolean;
	/** Events wait until the carousel has started, so loading on a later page doesn't count as a change */
	started: boolean;
	destroyed: boolean;
	/** The warnings already logged, so each is logged once per carousel */
	warnings: Set<string>;

	// Movement

	/**
	 * The slide a navigation is scrolling to, or `null` when there is none. A
	 * slide rather than a page, so it stays the same target when the pages change.
	 */
	targetSlide: HTMLElement | null;
	/** The scroll position the navigation asked for */
	targetPosition: number;
	/** Whether the current move came from autoplay, which isn't announced */
	fromAutoplay: boolean;
	/** Whether the track is scrolling, from its first scroll event until it settles */
	scrolling: boolean;
	touching: boolean;
	/** The scroll position the state was last worked out from, so later layout changes can be measured against it */
	lastScroll: number;
	/** When the track last scrolled, for telling when it has stopped */
	lastScrollAt: number;

	// Waiting timers and frames

	settleTimer: ReturnType<typeof setTimeout> | undefined;
	measureFrame: number;
	resumeFrame: number;
};

/** Logs a warning, once per carousel */
export const warnOnce = (ctx: Context, message: string) => {
	if (ctx.warnings.has(message)) return;
	ctx.warnings.add(message);
	log("warn", message);
};
