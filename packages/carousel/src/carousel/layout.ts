import log from "../lib/log.js";

/**
 * The carousel's geometry: where the slides sit along the scroll axis, and
 * the pages they snap to. Nothing here changes the page.
 */

export type Align = "start" | "center" | "end";

/** Which way the track scrolls */
export type Axis = { vertical: boolean; rtl: boolean };

export type Box = {
	/** The slide's start edge, in the track's scroll coordinates along the scroll axis */
	start: number;
	size: number;
};

export type Page = {
	/** The scroll position the page snaps to */
	position: number;
	/** The slide whose snap position the page uses */
	slide: number;
	/** Every slide that belongs to the page, in slide order */
	slides: number[];
};

export type Layout = Axis & {
	/** The track's visible size along the scroll axis */
	client: number;
	/** The furthest the track can scroll */
	max: number;
	/** The scroll position when it was measured */
	scroll: number;
	/** The track's and each slide's border box size when measured, for telling whether a resize changed them */
	sizes: Map<Element, string>;
	padStart: number;
	padEnd: number;
	/** The slides' `scroll-snap-align`, read from the first slide */
	align: Align;
	boxes: Box[];
	/** Each slide's own margin, at its start and end, which moves with it when slides are reordered. Only measured for looping. */
	outer: Array<[number, number]>;
	pages: Page[];
	/** The page each slide belongs to */
	slidePage: number[];
	/** Where the first slide's margin starts, and the space between slides' margins, for planning loop rotations. Only measured for looping. */
	origin: number;
	gap: number;
};

export const emptyLayout = (): Layout => ({
	vertical: false,
	rtl: false,
	client: 0,
	max: 0,
	scroll: 0,
	sizes: new Map(),
	padStart: 0,
	padEnd: 0,
	align: "start",
	boxes: [],
	outer: [],
	pages: [],
	slidePage: [],
	origin: 0,
	gap: 0,
});

export const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

/** A border box size, rounded, in the form `ResizeObserver` entries are compared in */
export const sizeKey = (width: number, height: number) =>
	`${Math.round(width * 10)}x${Math.round(height * 10)}`;

/**
 * The scroll position, measured from the start edge: right to left tracks
 * scroll to negative `scrollLeft` values, and this is always 0 or more
 */
export const readScroll = (track: HTMLElement, { vertical, rtl }: Axis) => {
	if (vertical) return track.scrollTop;
	return rtl ? -track.scrollLeft : track.scrollLeft;
};

/**
 * The scroll position that snaps a slide, following `scroll-snap-align` and
 * the track's `scroll-padding`. `start` is where the slide starts, which
 * looping can plan before the slides move.
 */
export const snapPosition = (layout: Layout, slide: number, start: number) => {
	const box = layout.boxes[slide];
	if (!box) return 0;
	const { align, client, padStart, padEnd } = layout;
	if (align === "end") return start + box.size - client + padEnd;
	if (align === "center")
		return start + box.size / 2 - padStart - (client - padStart - padEnd) / 2;
	return start - padStart;
};

/** The page whose position is nearest a scroll position */
export const nearestPage = (layout: Layout, scroll: number) => {
	let index = 0;
	let best = Number.POSITIVE_INFINITY;
	layout.pages.forEach((page, i) => {
		const distance = Math.abs(page.position - scroll);
		if (distance < best - 0.5) {
			best = distance;
			index = i;
		}
	});
	return index;
};

// ----------------------------------------------------------------
// Measuring

/** A computed length in pixels. Percentages, which `scroll-padding` keeps, are of `basis`. */
const px = (value: string | undefined, basis = 0) => {
	const number = Number.parseFloat(value ?? "");
	if (!Number.isFinite(number)) return 0;
	return value?.trim().endsWith("%") ? (number / 100) * basis : number;
};

/** A style's lengths at the start and end of the scroll axis, such as `margin-left` and `margin-right` for a left to right track */
const edges = (
	style: CSSStyleDeclaration,
	property: "margin" | "scrollPadding",
	{ vertical, rtl }: Axis,
	basis: number,
): [number, number] => {
	const [start, end] = vertical
		? (["Top", "Bottom"] as const)
		: rtl
			? (["Right", "Left"] as const)
			: (["Left", "Right"] as const);
	return [
		px(style[`${property}${start}`], basis),
		px(style[`${property}${end}`], basis),
	];
};

/**
 * Reads `scroll-snap-align` for the scroll axis. Its first value is for the
 * block axis and its second, when given, for the inline axis.
 */
const readAlign = (value: string, vertical: boolean): Align | null => {
	const parts = value.trim().split(/\s+/);
	const part = vertical ? parts[0] : (parts[1] ?? parts[0]);
	return part === "start" || part === "center" || part === "end" ? part : null;
};

/**
 * Groups slides into pages, the positions the carousel snaps to. Without
 * looping, positions are clamped to what the track can reach, so the slides
 * at the end that can't snap on their own share the last page.
 */
const buildPages = (layout: Layout, loop: boolean) => {
	const pages: Page[] = [];
	const slidePage: number[] = [];
	let furthest = Number.NEGATIVE_INFINITY;

	layout.boxes.forEach((box, slide) => {
		const raw = snapPosition(layout, slide, box.start);
		const position = loop ? raw : clamp(raw, 0, layout.max);

		// Positions usually grow from slide to slide, so a slide past every page so far starts a new one without searching them.
		const existing =
			loop || position >= furthest + 1
				? -1
				: pages.findIndex((page) => Math.abs(page.position - position) < 1);
		furthest = Math.max(furthest, position);

		if (existing >= 0) {
			pages[existing]?.slides.push(slide);
			slidePage[slide] = existing;
			return;
		}
		slidePage[slide] = pages.length;
		pages.push({ position, slide, slides: [slide] });
	});

	return { pages, slidePage };
};

/**
 * Where the first slide's margin starts, and the space between slides'
 * margins, for planning loop rotations. Slides are taken in the order they are
 * laid out. The space between them, less their own margins, is the track's
 * gap, which stays put when they move.
 */
const loopSpacing = (boxes: Box[], outer: Array<[number, number]>) => {
	const visual = boxes
		.map((box, slide) => ({ box, slide }))
		.sort((a, b) => a.box.start - b.box.start);

	const gaps: number[] = [];
	for (let i = 1; i < visual.length; i++) {
		const before = visual[i - 1];
		const after = visual[i];
		if (!before || !after) continue;
		const beforeEnd =
			before.box.start + before.box.size + (outer[before.slide]?.[1] ?? 0);
		const afterStart = after.box.start - (outer[after.slide]?.[0] ?? 0);
		gaps.push(afterStart - beforeEnd);
	}
	gaps.sort((a, b) => a - b);

	const first = visual[0];
	return {
		origin: first ? first.box.start - (outer[first.slide]?.[0] ?? 0) : 0,
		gap: gaps[Math.floor(gaps.length / 2)] ?? 0,
	};
};

let warnedAlign = false;

/**
 * Measures the track and its slides. Reads layout, so it only runs when
 * something changed size or the slides changed, not on every scroll.
 * - `loop` also measures what planning loop rotations needs, and leaves pages unclamped
 * - `previous` and `snapSuspended` keep the axis while snapping is turned off, as `scroll-snap-type` then reads `none`
 */
export const measureTrack = (
	track: HTMLElement,
	slides: HTMLElement[],
	loop: boolean,
	previous?: Layout,
	snapSuspended = false,
): Layout => {
	const style = getComputedStyle(track);
	const vertical =
		snapSuspended && previous
			? previous.vertical
			: /\b(y|block)\b/.test(style.scrollSnapType);
	const rtl = !vertical && style.direction === "rtl";
	const axis = { vertical, rtl };

	const client = vertical ? track.clientHeight : track.clientWidth;
	const scrollSize = vertical ? track.scrollHeight : track.scrollWidth;
	const max = Math.max(0, scrollSize - client);
	const scroll = readScroll(track, axis);
	const [padStart, padEnd] = edges(style, "scrollPadding", axis, client);

	let align = slides[0]
		? readAlign(getComputedStyle(slides[0]).scrollSnapAlign || "", vertical)
		: "start";
	if (!align) {
		if (__DEV__ && !warnedAlign) {
			warnedAlign = true;
			log(
				"warn",
				"The first slide has no scroll-snap-align, so the slides are treated as start aligned. Add the CSS from the README so the track snaps.",
			);
		}
		align = "start";
	}

	// The edges of the track's padding box, which scroll positions are measured from.
	const rect = track.getBoundingClientRect();
	const innerStart = vertical
		? rect.top + track.clientTop
		: rect.left + track.clientLeft;
	const innerEnd = innerStart + (vertical ? 0 : track.clientWidth);
	const sizes = new Map<Element, string>([
		[track, sizeKey(rect.width, rect.height)],
	]);

	const boxes: Box[] = [];
	const outer: Array<[number, number]> = [];
	for (const slide of slides) {
		const box = slide.getBoundingClientRect();
		sizes.set(slide, sizeKey(box.width, box.height));
		const start = vertical
			? box.top - innerStart
			: rtl
				? innerEnd - box.right
				: box.left - innerStart;
		boxes.push({
			start: start + scroll,
			size: vertical ? box.height : box.width,
		});
		if (loop)
			outer.push(edges(getComputedStyle(slide), "margin", axis, client));
	}

	const { origin, gap } = loop
		? loopSpacing(boxes, outer)
		: { origin: 0, gap: 0 };

	const layout: Layout = {
		vertical,
		rtl,
		client,
		max,
		scroll,
		sizes,
		padStart,
		padEnd,
		align,
		boxes,
		outer,
		pages: [],
		slidePage: [],
		origin,
		gap,
	};
	const { pages, slidePage } = buildPages(layout, loop);
	layout.pages = pages;
	layout.slidePage = slidePage;
	return layout;
};
