import C from "../constants.js";
import format from "../lib/format.js";
import owned from "../lib/owned.js";
import S from "../state.js";
import type { Context } from "./context.js";
import { clamp, type Page } from "./layout.js";

const A = C.attributes;
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus to pass from a generated marker to its replacement */
type Refocus = {
	markers: HTMLElement[];
	/** The slide the focused marker scrolled to */
	slide: number;
	/** Where the focused element was inside the marker */
	path: number[];
};

// ----------------------------------------------------------------
// Markers the author wrote

/**
 * The slide a marker scrolls to: its value, the slide its fragment link
 * points at, or else its position among the markers
 */
export const markerTarget = (
	marker: HTMLElement,
	order: number,
	slides: HTMLElement[],
) => {
	const value = marker.getAttribute(A.marker);
	if (value && /^\d+$/.test(value)) return Number(value);

	const href = marker.getAttribute("href");
	if (href?.startsWith("#") && href.length > 1) {
		let id = href.slice(1);
		try {
			id = decodeURIComponent(id);
		} catch {}
		const target = document.getElementById(id);
		const slide = target
			? slides.findIndex((s) => s === target || s.contains(target))
			: -1;
		if (slide >= 0) return slide;
	}

	return order;
};

// ----------------------------------------------------------------
// Markers cloned from a template

/** Replaces `{n}` and `{count}` in an element's text and attributes */
const fill = (element: Element, n: number, count: number) => {
	for (const target of [element, ...element.querySelectorAll("*")]) {
		for (const attribute of Array.from(target.attributes)) {
			if (attribute.value.includes("{"))
				attribute.value = format(attribute.value, n, count);
		}
	}
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node.nodeValue?.includes("{"))
			node.nodeValue = format(node.nodeValue, n, count);
	}
};

/** Whether an element has a name for assistive technology, from its text or an aria attribute */
const hasName = (element: Element) =>
	element.hasAttribute("aria-label") ||
	element.hasAttribute("aria-labelledby") ||
	(element.textContent ?? "").trim() !== "";

/**
 * Clones a markers container's `<template>` once per page
 * - `{n}` and `{count}` in the template's text and attributes become the page number and the number of pages
 * - Each marker gets `data-carousel--marker` with the slide it scrolls to, `aria-controls` naming the track, and an `aria-label` when it has no name
 */
const cloneMarkers = (
	container: Element,
	template: HTMLTemplateElement,
	pages: Page[],
	label: string,
	track: string,
) => {
	const first = template.content.firstElementChild;
	if (!(first instanceof HTMLElement)) return [];

	// A template without `{n}` or `{count}` is cloned as it is.
	const placeholders = first.outerHTML.includes("{");
	// What every marker shares is set once, on the copy they are cloned from.
	const source = first.cloneNode(true) as HTMLElement;
	if (source instanceof HTMLButtonElement && !source.hasAttribute("type"))
		source.type = "button";
	if (track) source.setAttribute("aria-controls", track);
	const named = hasName(source);

	const markers: HTMLElement[] = [];
	const fragment = document.createDocumentFragment();
	pages.forEach((page, index) => {
		const clone = source.cloneNode(true) as HTMLElement;
		if (placeholders) fill(clone, index + 1, pages.length);
		clone.setAttribute(A.marker, String(page.slide));
		if (!named)
			clone.setAttribute("aria-label", format(label, index + 1, pages.length));
		markers.push(clone);
		fragment.append(clone);
	});
	container.append(fragment);
	return markers;
};

const templateOf = (container: Element) =>
	Array.from(container.children).find(
		(child): child is HTMLTemplateElement =>
			child instanceof HTMLTemplateElement,
	);

/** Whether a marker was cloned from a template */
export const isGenerated = (ctx: Context, element: Element) => {
	for (const entry of ctx.generated.values())
		if (entry.markers.includes(element as HTMLElement)) return true;
	return false;
};

const removeMarkers = (ctx: Context, markers: HTMLElement[]) => {
	const { markerSlides, rec } = ctx;
	for (const marker of markers) {
		markerSlides.delete(marker);
		rec.forget(marker);
		marker.remove();
	}
};

/**
 * Clones each markers `<template>` once per page, when the pages or the
 * template changed. A marker holding focus passes it to its replacement.
 */
export const renderGeneratedMarkers = (ctx: Context) => {
	const { generated } = ctx;
	const authored = ctx.markers.filter((marker) => !isGenerated(ctx, marker));
	const containers = owned(ctx.root, `[${A.markers}]`);

	// Containers that left the carousel or lost their template lose their markers.
	for (const [container, entry] of generated) {
		if (containers.includes(container) && templateOf(container)) continue;
		removeMarkers(ctx, entry.markers);
		generated.delete(container);
	}

	// Focus is passed on once every container is rendered, as focusing can stop autoplay and run listeners.
	const pagesKey = ctx.layout.pages.map((page) => page.slide).join();
	let refocus: Refocus | null = null;
	for (const container of containers)
		refocus = renderContainer(ctx, container, pagesKey) ?? refocus;

	ctx.markers = [
		...authored,
		...Array.from(generated.values()).flatMap((entry) => entry.markers),
	];
	if (refocus) passFocus(ctx, refocus);
};

/**
 * Renders one container's markers again when the pages or its template
 * changed. Returns the focus to pass on when one of the old markers held it.
 */
const renderContainer = (
	ctx: Context,
	container: HTMLElement,
	pagesKey: string,
): Refocus | null => {
	const { generated, markerSlides } = ctx;
	const template = templateOf(container);
	if (!template) return null;
	const key = `${pagesKey}|${template.innerHTML}`;
	const existing = generated.get(container);
	if (existing?.key === key) return null;

	const active = document.activeElement;
	const focused = existing?.markers.find(
		(marker) => active !== null && marker.contains(active),
	);
	const focusedSlide = focused ? markerSlides.get(focused) : undefined;
	if (existing) removeMarkers(ctx, existing.markers);

	const { pages } = ctx.layout;
	const markers = cloneMarkers(
		container,
		template,
		pages,
		S.labels.marker,
		ctx.track.id,
	);
	markers.forEach((marker, page) => {
		markerSlides.set(marker, pages[page]?.slide ?? 0);
	});
	generated.set(container, { key, markers });

	if (!focused || focusedSlide === undefined || !active) return null;
	return { markers, slide: focusedSlide, path: pathTo(focused, active) };
};

/** The child indexes from an element down to one of its descendants */
const pathTo = (from: Element, to: Element) => {
	const path: number[] = [];
	for (
		let node: Element | null = to;
		node && node !== from;
		node = node.parentElement
	) {
		const parent: Element | null = node.parentElement;
		if (!parent) break;
		path.unshift(Array.prototype.indexOf.call(parent.children, node));
	}
	return path;
};

/**
 * Focuses the replacement of a rebuilt marker for the same page: the element
 * at the same place inside it, or else its first focusable element
 */
const passFocus = (ctx: Context, { markers, slide, path }: Refocus) => {
	const page =
		ctx.layout.slidePage[clamp(slide, 0, ctx.slides.length - 1)] ?? 0;
	const marker = markers[Math.min(page, markers.length - 1)];
	if (!marker) return;

	let target: Element | undefined = marker;
	for (const index of path) target = target?.children[index];

	const candidates = [
		target,
		marker,
		...Array.from(marker.querySelectorAll(FOCUSABLE)),
	];
	for (const candidate of candidates) {
		if (!(candidate instanceof HTMLElement)) continue;
		candidate.focus({ preventScroll: true });
		if (ctx.destroyed || document.activeElement === candidate) return;
	}
};
