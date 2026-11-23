/**
 * happy-dom has no layout, so tracks are given a fake one: slides sit in a
 * row, in their CSS `order`, and the track scrolls within the bounds a real
 * one would, firing `scroll` and `scrollend`.
 */
type FakeLayout = {
	/** The track's visible width, or height when vertical */
	size: number;
	/** Each slide's width, or one width for every slide */
	slide: number | number[];
	gap?: number;
	vertical?: boolean;
	rtl?: boolean;
};

const layouts = new WeakMap<HTMLElement, FakeLayout>();
const positions = new WeakMap<HTMLElement, number>();
let patched = false;

const slidesOf = (track: HTMLElement) =>
	Array.from(track.children).filter(
		(child): child is HTMLElement =>
			child instanceof HTMLElement && child.localName !== "template",
	);

const sizeOf = (layout: FakeLayout, index: number) =>
	Array.isArray(layout.slide) ? (layout.slide[index] ?? 0) : layout.slide;

/** A slide's margins along the row, from its computed style */
const marginsOf = (slide: HTMLElement, layout: FakeLayout) => {
	const style = getComputedStyle(slide);
	const read = (value: string) => Number.parseFloat(value) || 0;
	return layout.vertical
		? [read(style.marginTop), read(style.marginBottom)]
		: [read(style.marginLeft), read(style.marginRight)];
};

const extent = (track: HTMLElement, layout: FakeLayout) => {
	const slides = slidesOf(track);
	const gap = layout.gap ?? 0;
	return (
		slides.reduce((sum, slide, index) => {
			const [before = 0, after = 0] = marginsOf(slide, layout);
			return sum + before + sizeOf(layout, index) + after;
		}, 0) +
		gap * Math.max(0, slides.length - 1)
	);
};

const maxScroll = (track: HTMLElement, layout: FakeLayout) =>
	Math.max(0, extent(track, layout) - layout.size);

/** Where each slide starts, following `style.order` and then the DOM order */
const starts = (track: HTMLElement, layout: FakeLayout) => {
	const slides = slidesOf(track);
	const gap = layout.gap ?? 0;
	const visual = slides
		.map((slide, index) => ({
			slide,
			index,
			order: Number(slide.style.order || 0),
		}))
		.sort((a, b) => a.order - b.order || a.index - b.index);
	const result = new Map<HTMLElement, { start: number; size: number }>();
	let cursor = 0;
	for (const { slide, index } of visual) {
		const size = sizeOf(layout, index);
		const [before = 0, after = 0] = marginsOf(slide, layout);
		cursor += before;
		result.set(slide, { start: cursor, size });
		cursor += size + after + gap;
	}
	return result;
};

const rect = (x: number, y: number, width: number, height: number) =>
	({
		x,
		y,
		left: x,
		top: y,
		width,
		height,
		right: x + width,
		bottom: y + height,
		toJSON: () => ({}),
	}) as DOMRect;

const patch = () => {
	if (patched) return;
	patched = true;
	const { getBoundingClientRect } = Element.prototype as {
		getBoundingClientRect: (this: Element) => DOMRect;
	};
	Element.prototype.getBoundingClientRect = function (this: Element) {
		if (this instanceof HTMLElement) {
			const own = layouts.get(this);
			if (own) {
				return own.vertical
					? rect(0, 0, 300, own.size)
					: rect(0, 0, own.size, 300);
			}
			const parent = this.parentElement;
			const layout = parent ? layouts.get(parent) : undefined;
			if (parent && layout) {
				const box = starts(parent, layout).get(this);
				if (box) {
					const scroll = positions.get(parent) ?? 0;
					const start = box.start - scroll;
					if (layout.vertical) return rect(0, start, 300, box.size);
					if (layout.rtl)
						return rect(layout.size - start - box.size, 0, box.size, 300);
					return rect(start, 0, box.size, 300);
				}
			}
		}
		return getBoundingClientRect.call(this);
	};
};

/** The track's scroll position from its start edge */
export const scrollOf = (track: HTMLElement) => positions.get(track) ?? 0;

/**
 * Gives a track a fake layout. Scrolling it, by the library or with
 * `scrollTrack`, fires `scroll` and then `scrollend`.
 */
export const fakeLayout = (track: HTMLElement, layout: FakeLayout) => {
	patch();
	layouts.set(track, layout);
	positions.set(track, 0);

	const set = (logical: number) => {
		const next = Math.min(Math.max(logical, 0), maxScroll(track, layout));
		const changed = next !== positions.get(track);
		positions.set(track, next);
		return changed;
	};
	const fire = () => {
		track.dispatchEvent(new Event("scroll"));
		queueMicrotask(() => track.dispatchEvent(new Event("scrollend")));
	};

	const along = layout.vertical ? "Height" : "Width";
	const across = layout.vertical ? "Width" : "Height";
	Object.defineProperty(track, `client${along}`, {
		configurable: true,
		get: () => layout.size,
	});
	Object.defineProperty(track, `client${across}`, {
		configurable: true,
		get: () => 300,
	});
	Object.defineProperty(track, `scroll${along}`, {
		configurable: true,
		get: () => Math.max(layout.size, extent(track, layout)),
	});
	Object.defineProperty(track, `scroll${across}`, {
		configurable: true,
		get: () => 300,
	});
	const physical = (logical: number) => (layout.rtl ? -logical : logical);
	const logical = (value: number) => (layout.rtl ? -value : value);
	Object.defineProperty(track, layout.vertical ? "scrollTop" : "scrollLeft", {
		configurable: true,
		get: () => physical(positions.get(track) ?? 0),
		set: (value: number) => {
			if (set(logical(value))) fire();
		},
	});
	track.scrollTo = ((options: ScrollToOptions) => {
		const value = layout.vertical ? options.top : options.left;
		if (value !== undefined && set(logical(value))) fire();
	}) as typeof track.scrollTo;
};

/** Scrolls a track as a visitor would, to a position from its start edge */
export const scrollTrack = async (track: HTMLElement, position: number) => {
	const layout = layouts.get(track);
	if (!layout) throw new Error("The track has no fake layout");
	const value = layout.rtl ? -position : position;
	if (layout.vertical) track.scrollTop = value;
	else track.scrollLeft = value;
	await frame();
};

/** Waits for scroll events, animation frames and microtasks to run */
export const frame = async () => {
	for (let i = 0; i < 3; i++) {
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		await Promise.resolve();
	}
};

export const $ = <E extends Element = HTMLElement>(selector: string) => {
	const element = document.querySelector<E>(selector);
	if (!element) throw new Error(`No element matches ${selector}`);
	return element;
};

export const $$ = <E extends Element = HTMLElement>(selector: string) =>
	Array.from(document.querySelectorAll<E>(selector));

/** Builds a carousel's markup with `count` slides */
export const carouselMarkup = (
	count: number,
	{
		attributes = "",
		slide = "div",
		controls = true,
		extra = "",
	}: {
		attributes?: string;
		slide?: string;
		controls?: boolean;
		extra?: string;
	} = {},
) => `
	<section data-carousel aria-label="Gallery" ${attributes}>
		<div data-carousel--track class="track">
			${Array.from({ length: count }, (_, i) => `<${slide} id="slide-${i}" class="slide">Slide ${i + 1}</${slide}>`).join("")}
		</div>
		${
			controls
				? `<button id="prev" data-carousel--action="prev">Previous</button>
		<button id="next" data-carousel--action="next">Next</button>`
				: ""
		}
		${extra}
	</section>
`;

/** Snapping CSS, as a page would have it */
export const snapStyles = `
	<style>
		.track { display: flex; scroll-snap-type: x mandatory; }
		.slide { scroll-snap-align: start; }
	</style>
`;

/** Reports a resize to every carousel, as a ResizeObserver would after layout. */
export const resize = async () => {
	const { resizeObservers } = await import("./setup.js");
	for (const notify of resizeObservers) notify();
	await frame();
};
