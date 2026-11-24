import C from "../constants.js";
import controlledRoot from "../lib/controlled-root.js";
import named from "../lib/named.js";
import owned from "../lib/owned.js";
import S from "../state.js";
import {
	type Config,
	type Context,
	message,
	type Operated,
	warnOnce,
} from "./context.js";
import { isGenerated, markerTarget } from "./markers.js";
import { remeasure } from "./measure.js";
import type { Recorder } from "./recorder.js";
import { applyInert, update } from "./render.js";

const A = C.attributes;

// ----------------------------------------------------------------
// Reading

/** A boolean option attribute: present, and not `"false"` */
const flag = (element: Element, name: string) => {
	const value = element.getAttribute(name);
	return value !== null && value !== "false";
};

export const readConfig = (root: HTMLElement): Config => {
	let autoplay: number | null = null;
	if (flag(root, A.autoplay)) {
		const delay = Number.parseInt(root.getAttribute(A.autoplay) ?? "", 10);
		autoplay = Number.isFinite(delay) && delay > 0 ? delay : C.autoplay;
	}
	return {
		loop: flag(root, A.loop),
		rewind: flag(root, A.rewind),
		drag: flag(root, A.drag),
		inert: flag(root, A.inert),
		autoplay,
	};
};

/** Slides are the track's element children, other than templates, scripts and styles */
const readSlides = (track: HTMLElement) =>
	Array.from(track.children).filter(
		(child): child is HTMLElement =>
			child instanceof HTMLElement &&
			!(child instanceof HTMLTemplateElement) &&
			child.localName !== "script" &&
			child.localName !== "style",
	);

/**
 * The controls and markers that operate a carousel: the ones inside it,
 * unless their `aria-controls` names another carousel, and the ones elsewhere
 * whose `aria-controls` names this one
 */
const findOperated = (root: HTMLElement): Operated => {
	const operating = (selector: string) =>
		Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
			(element) => controlledRoot(element) === root,
		);
	return {
		controls: operating(`[${A.action}]`),
		markers: operating(`[${A.marker}]`),
	};
};

/** Whether an element has no meaning of its own: a `div`, `span` or custom element without a role */
const isGeneric = (element: HTMLElement) =>
	!element.hasAttribute("role") &&
	(element.localName === "div" ||
		element.localName === "span" ||
		element.localName.includes("-"));

/**
 * Whether a slide gets carousel slide semantics: a generic element, or one the
 * markup already made a group. Others, such as list items, links and
 * articles, keep their own.
 */
const takesSlideRole = (slide: HTMLElement) =>
	isGeneric(slide) || slide.getAttribute("role") === "group";

// ----------------------------------------------------------------
// Adding what the markup leaves out

/** Buttons without a `type` would submit a form they are in */
const setButtonType = (rec: Recorder, element: HTMLElement) => {
	if (element instanceof HTMLButtonElement && !element.hasAttribute("type"))
		rec.attr(element, "type", "button");
};

const describeCarousel = (ctx: Context) => {
	const { rec, root, track } = ctx;
	if (!track.id) rec.attr(track, "id", `carousel-${++S.ids}-track`);
	rec.fallback(root, "role", "region");
	rec.fallback(root, "aria-roledescription", message(ctx, "carouselRole"));
	if (
		__DEV__ &&
		!root.hasAttribute("aria-label") &&
		!root.hasAttribute("aria-labelledby")
	)
		warnOnce(
			ctx,
			'A carousel has no aria-label or aria-labelledby. Name it after its content, such as aria-label="Featured products", without the word "carousel".',
		);
};

const describeSlides = (ctx: Context) => {
	const { rec, slides } = ctx;
	const role = message(ctx, "slideRole");
	slides.forEach((slide, i) => {
		if (!takesSlideRole(slide)) return;
		rec.fallback(slide, "role", "group");
		rec.fallback(slide, "aria-roledescription", role);
		if (!slide.hasAttribute("aria-labelledby"))
			rec.fallback(
				slide,
				"aria-label",
				message(ctx, "slide", i + 1, slides.length),
			);
	});
};

/**
 * Takes on the controls and markers that operate this carousel. Icon-only
 * `prev` and `next` controls and markers without a name get an `aria-label`.
 */
const describeOperated = (ctx: Context, found: Operated) => {
	const { markerSlides, rec, root, slides, track } = ctx;
	ctx.controls = found.controls;
	for (const control of ctx.controls) {
		if (root.contains(control))
			rec.fallback(control, "aria-controls", track.id);
		setButtonType(rec, control);
		const action = control.getAttribute(A.action);
		if (
			(action === C.actions.prev || action === C.actions.next) &&
			!named(control)
		)
			rec.fallback(control, "aria-label", message(ctx, action));
	}

	markerSlides.clear();
	for (const entry of ctx.generated.values())
		for (const marker of entry.markers)
			markerSlides.set(marker, Number(marker.getAttribute(A.marker)));
	// The generated markers join again once they are rendered for the new layout.
	ctx.markers = found.markers.filter((marker) => !isGenerated(ctx, marker));
	ctx.markers.forEach((marker, order) => {
		const slide = markerTarget(marker, order, slides);
		markerSlides.set(marker, slide);
		if (root.contains(marker) && !(marker instanceof HTMLAnchorElement))
			rec.fallback(marker, "aria-controls", track.id);
		setButtonType(rec, marker);
		if (!named(marker))
			rec.fallback(
				marker,
				"aria-label",
				message(ctx, "marker", slide + 1, slides.length),
			);
	});
};

/** Makes generic markers containers a group named for choosing a slide, as the WAI-ARIA carousel pattern does */
const describeMarkerGroups = (ctx: Context) => {
	for (const container of owned(ctx.root, `[${A.markers}]`)) {
		if (!isGeneric(container)) continue;
		ctx.rec.fallback(container, "role", "group");
		if (!container.hasAttribute("aria-labelledby"))
			ctx.rec.fallback(container, "aria-label", message(ctx, "markers"));
	}
};

const describeStatuses = (ctx: Context) => {
	ctx.statuses = owned(ctx.root, `[${A.status}]`);
	for (const status of ctx.statuses) {
		ctx.rec.fallback(status, "aria-live", "polite");
		ctx.rec.fallback(status, "aria-atomic", "true");
	}
};

/**
 * Warns when autoplay has no control to stop it, as WCAG requires one, and
 * when a carousel that scrolls has no controls or markers to move it
 */
export const checkControls = (ctx: Context) => {
	if (!__DEV__) return;
	const actions = new Set(
		ctx.controls.map((control) => control.getAttribute(A.action)),
	);
	if (
		ctx.config.autoplay !== null &&
		!actions.has(C.actions.toggle) &&
		!actions.has(C.actions.pause)
	)
		warnOnce(
			ctx,
			'An autoplaying carousel has no data-carousel--action="toggle" or "pause" control. Add one so visitors can stop it.',
		);
	if (
		ctx.state.scrollable &&
		!actions.has(C.actions.prev) &&
		!actions.has(C.actions.next) &&
		ctx.markers.length === 0
	)
		warnOnce(
			ctx,
			'A carousel that scrolls has no data-carousel--action="prev" or "next" controls, and no markers. Add some, as visitors using a mouse or keyboard may have no other way to move it.',
		);
};

// ----------------------------------------------------------------
// Scanning

/**
 * Reads the options, slides, controls, markers and status elements,
 * and adds the attributes they leave out, without measuring
 * - `found` is passed when the controls and markers were already found, for carousels starting together
 */
export const readMarkup = (ctx: Context, found = findOperated(ctx.root)) => {
	ctx.config = readConfig(ctx.root);
	if (ctx.config.drag) {
		if (S.drag) S.drag(ctx);
		else if (__DEV__)
			warnOnce(
				ctx,
				'A carousel has data-carousel--drag, but drag wasn\'t passed to carousel.init(). Import it from "@lucidclient/carousel/drag".',
			);
	}
	ctx.slides = readSlides(ctx.track);
	ctx.slideFlags = [];

	describeCarousel(ctx);
	describeSlides(ctx);
	describeOperated(ctx, found);
	describeMarkerGroups(ctx);
	describeStatuses(ctx);

	ctx.resize.disconnect();
	ctx.resize.observe(ctx.track);
	for (const slide of ctx.slides) ctx.resize.observe(slide);
};

/** Puts the markup back as it was rendered, keeping the listeners, so it can be read again */
export const resetMarkup = (ctx: Context) => {
	ctx.rec.restore();
	ctx.rotation = 0;
	ctx.rotated = false;
};

/**
 * Reads the markup again from how it was rendered, measures, and puts the
 * slide that was in view back. Runs when slides are added or removed, and on
 * refresh.
 */
export const rescan = (ctx: Context) => {
	resetMarkup(ctx);
	readMarkup(ctx);
	remeasure(ctx, true, true);
	update(ctx, true);
	applyInert(ctx);
	checkControls(ctx);
};
