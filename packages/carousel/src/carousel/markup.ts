import C from "../constants.js";
import controlledRoot from "../lib/controlled-root.js";
import format from "../lib/format.js";
import owned from "../lib/owned.js";
import S from "../state.js";
import {
	type Config,
	type Context,
	type Operated,
	warnOnce,
} from "./context.js";
import { setUpDrag } from "./drag.js";
import { clamp } from "./layout.js";
import { centre } from "./loop.js";
import { isGenerated, markerTarget } from "./markers.js";
import { remeasure } from "./measure.js";
import type { Recorder } from "./recorder.js";
import { applyInert, update } from "./render.js";
import { jump, position, resumeSnap, suspendSnap } from "./scroll.js";

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

/**
 * Whether a slide gets carousel slide semantics: generic elements, such as a
 * `div` or a custom element, or one the markup already made a group. Others,
 * such as list items, links and articles, keep their own.
 */
const takesSlideRole = (slide: HTMLElement) => {
	const role = slide.getAttribute("role");
	if (role !== null) return role === "group";
	return (
		slide.localName === "div" ||
		slide.localName === "span" ||
		slide.localName.includes("-")
	);
};

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
	rec.fallback(root, "aria-roledescription", "carousel");
	if (!root.hasAttribute("aria-label") && !root.hasAttribute("aria-labelledby"))
		warnOnce(
			ctx,
			'A carousel has no aria-label or aria-labelledby. Name it after its content, such as aria-label="Featured products", without the word "carousel".',
		);
};

const describeSlides = (ctx: Context) => {
	const { rec, slides } = ctx;
	slides.forEach((slide, i) => {
		if (!takesSlideRole(slide) && !rec.added(slide, "role")) {
			// The slide's role changed since, so the slide semantics added with it go too.
			for (const name of ["aria-roledescription", "aria-label"])
				if (rec.added(slide, name)) rec.attr(slide, name, null);
			return;
		}
		rec.fallback(slide, "role", "group");
		rec.fallback(slide, "aria-roledescription", "slide");
		if (!slide.hasAttribute("aria-labelledby"))
			rec.fallback(
				slide,
				"aria-label",
				format(S.labels.slide, i + 1, slides.length),
			);
	});
};

/**
 * Takes on the controls and markers that operate this carousel. Ones that now
 * operate another carousel, or left the page, are handed back, and ones
 * another carousel had are handed over by it, before either writes to them.
 */
const adoptOperated = (ctx: Context, found: Operated) => {
	const { markerSlides, rec, root, slides, track } = ctx;
	const authored = (markers: HTMLElement[]) =>
		markers.filter((marker) => !isGenerated(ctx, marker));
	const previous = [...ctx.controls, ...authored(ctx.markers)];
	const controls = found.controls;
	const markers = authored(found.markers);

	for (const element of previous)
		if (!controls.includes(element) && !markers.includes(element))
			rec.restore(element);
	for (const element of [...controls, ...markers]) {
		if (previous.includes(element)) continue;
		for (const [other, instance] of S.instances)
			if (other !== root) instance.release(element);
	}

	ctx.controls = controls;
	for (const control of controls) {
		if (root.contains(control))
			rec.fallback(control, "aria-controls", track.id);
		setButtonType(rec, control);
	}

	markerSlides.clear();
	for (const entry of ctx.generated.values())
		for (const marker of entry.markers)
			markerSlides.set(marker, Number(marker.getAttribute(A.marker)));
	// The generated markers join again once they are rendered for the new layout.
	ctx.markers = markers;
	markers.forEach((marker, order) => {
		markerSlides.set(marker, markerTarget(marker, order, slides));
		if (root.contains(marker) && !(marker instanceof HTMLAnchorElement))
			rec.fallback(marker, "aria-controls", track.id);
		setButtonType(rec, marker);
	});
};

const describeStatuses = (ctx: Context) => {
	ctx.statuses = owned(ctx.root, `[${A.status}]`);
	for (const status of ctx.statuses) {
		ctx.rec.fallback(status, "aria-live", "polite");
		ctx.rec.fallback(status, "aria-atomic", "true");
	}
};

/** Warns when autoplay has no control to stop it, as WCAG requires one */
export const checkAutoplayControl = (ctx: Context) => {
	if (ctx.config.autoplay === null) return;
	const stoppable = ctx.controls.some((control) => {
		const action = control.getAttribute(A.action);
		return action === C.actions.toggle || action === C.actions.pause;
	});
	if (!stoppable)
		warnOnce(
			ctx,
			'An autoplaying carousel has no data-carousel--action="toggle" or "pause" control. Add one so visitors can stop it.',
		);
};

// ----------------------------------------------------------------
// Scanning

/**
 * Reads the options, slides, controls, markers and status elements, and adds
 * the attributes they leave out, without measuring. Returns the slide that
 * was in view, so the caller can keep it in place when the slides changed.
 * - `found` is passed when the controls and markers were already found, for carousels starting together
 */
export const readMarkup = (ctx: Context, found = findOperated(ctx.root)) => {
	ctx.config = readConfig(ctx.root);
	if (ctx.config.drag) setUpDrag(ctx);

	// The slide in view stays where it is when slides are added or removed. Its offset is
	// measured from the last update, as the browser may have scrolled the track since.
	const { layout } = ctx;
	const anchor = ctx.slides[layout.pages[ctx.state.index]?.slide ?? -1];
	const anchorBox = anchor
		? layout.boxes[ctx.slides.indexOf(anchor)]
		: undefined;
	const anchorOffset = anchorBox ? anchorBox.start - ctx.lastScroll : 0;

	const slides = readSlides(ctx.track);
	const changed =
		slides.length !== ctx.slides.length ||
		slides.some((slide, i) => slide !== ctx.slides[i]);
	for (const slide of ctx.slides)
		if (!slides.includes(slide)) ctx.rec.restore(slide);
	ctx.slides = slides;

	describeCarousel(ctx);
	describeSlides(ctx);
	adoptOperated(ctx, found);
	describeStatuses(ctx);

	ctx.resize.disconnect();
	ctx.resize.observe(ctx.track);
	for (const slide of slides) ctx.resize.observe(slide);
	if (changed) ctx.slideFlags = [];

	return { changed, anchor, anchorOffset };
};

/**
 * Reads the markup again and measures, keeping the slide in view where it
 * was. Runs when slides are added or removed, and on refresh.
 */
export const rescan = (ctx: Context) => {
	const { changed, anchor, anchorOffset } = readMarkup(ctx);
	remeasure(ctx, true);

	const index = anchor ? ctx.slides.indexOf(anchor) : -1;
	const box = ctx.layout.boxes[index];
	if (changed && box && ctx.targetSlide === null) {
		const target = clamp(box.start - anchorOffset, 0, ctx.layout.max);
		if (ctx.looping) {
			suspendSnap(ctx);
			jump(ctx, target);
			centre(ctx, index);
			resumeSnap(ctx, true);
		} else if (Math.abs(target - position(ctx)) > 1) jump(ctx, target);
	}

	update(ctx, true);
	applyInert(ctx);
	checkAutoplayControl(ctx);
};

/** Hands a control or marker over to another carousel, putting back what this one wrote to it */
export const handOver = (ctx: Context, element: HTMLElement) => {
	if (!ctx.controls.includes(element) && !ctx.markers.includes(element)) return;
	ctx.controls = ctx.controls.filter((control) => control !== element);
	ctx.markers = ctx.markers.filter((marker) => marker !== element);
	ctx.markerSlides.delete(element);
	ctx.rec.restore(element);
};
