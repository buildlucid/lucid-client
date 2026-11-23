import C from "../constants.js";
import controlledRoot from "../lib/controlled-root.js";
import format from "../lib/format.js";
import owned from "../lib/owned.js";
import S from "../state.js";
import type { Labels } from "../types.js";
import {
	type Config,
	type Context,
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

/** The labels passed to `init`, with any the carousel sets with `data-carousel--label-{name}` */
export const readLabels = (root: HTMLElement): Labels => {
	const labels = { ...S.labels };
	for (const key of Object.keys(labels) as Array<keyof Labels>) {
		const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
		const value = root.getAttribute(`${A.label}-${name}`);
		if (value !== null) labels[key] = value;
	}
	return labels;
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
	const { labels, rec, root, track } = ctx;
	if (!track.id) rec.attr(track, "id", `carousel-${++S.ids}-track`);
	rec.fallback(root, "role", "region");
	rec.fallback(root, "aria-roledescription", labels.carouselRole);
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
	const { labels, rec, slides } = ctx;
	slides.forEach((slide, i) => {
		if (!takesSlideRole(slide)) return;
		rec.fallback(slide, "role", "group");
		rec.fallback(slide, "aria-roledescription", labels.slideRole);
		if (!slide.hasAttribute("aria-labelledby"))
			rec.fallback(
				slide,
				"aria-label",
				format(labels.slide, i + 1, slides.length),
			);
	});
};

/** Takes on the controls and markers that operate this carousel */
const describeOperated = (ctx: Context, found: Operated) => {
	const { markerSlides, rec, root, slides, track } = ctx;
	ctx.controls = found.controls;
	for (const control of ctx.controls) {
		if (root.contains(control))
			rec.fallback(control, "aria-controls", track.id);
		setButtonType(rec, control);
	}

	markerSlides.clear();
	for (const entry of ctx.generated.values())
		for (const marker of entry.markers)
			markerSlides.set(marker, Number(marker.getAttribute(A.marker)));
	// The generated markers join again once they are rendered for the new layout.
	ctx.markers = found.markers.filter((marker) => !isGenerated(ctx, marker));
	ctx.markers.forEach((marker, order) => {
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
	if (!__DEV__ || ctx.config.autoplay === null) return;
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
 * Reads the options, labels, slides, controls, markers and status elements,
 * and adds the attributes they leave out, without measuring
 * - `found` is passed when the controls and markers were already found, for carousels starting together
 */
export const readMarkup = (ctx: Context, found = findOperated(ctx.root)) => {
	ctx.config = readConfig(ctx.root);
	ctx.labels = readLabels(ctx.root);
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
	checkAutoplayControl(ctx);
};
