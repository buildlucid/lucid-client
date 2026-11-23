import type { Context } from "./context.js";
import { readScroll } from "./layout.js";

// ----------------------------------------------------------------
// Held styles

export type HeldStyles = {
	/** Sets an important inline style until it is released. Returns `false` when the property is already held. */
	hold: (property: string, value: string) => boolean;
	/** Puts a held property back exactly as it was */
	release: (property: string) => void;
	isHeld: (property: string) => boolean;
	/** Releases every held property and stops later holds, once the carousel is destroyed */
	close: () => void;
};

/**
 * Inline styles set on the track for a moment, such as turning snapping off
 * while the library reorders the slides, then put back exactly as they were
 */
export const createHeldStyles = (track: HTMLElement): HeldStyles => {
	const held = new Map<string, { value: string; priority: string }>();
	let closed = false;

	const release = (property: string) => {
		const original = held.get(property);
		if (!original) return;
		held.delete(property);
		if (original.value)
			track.style.setProperty(property, original.value, original.priority);
		else track.style.removeProperty(property);
	};

	return {
		hold: (property, value) => {
			if (closed || held.has(property)) return false;
			held.set(property, {
				value: track.style.getPropertyValue(property),
				priority: track.style.getPropertyPriority(property),
			});
			track.style.setProperty(property, value, "important");
			return true;
		},
		release,
		isHeld: (property) => held.has(property),
		close: () => {
			closed = true;
			for (const property of Array.from(held.keys())) release(property);
		},
	};
};

// ----------------------------------------------------------------
// Scroll position

/** The scroll position from the track's start edge */
export const position = (ctx: Context) => readScroll(ctx.track, ctx.layout);

/** `scrollLeft` or `scrollTop` as the browser has it, which is negative in right to left tracks */
export const physicalScroll = (ctx: Context) =>
	ctx.layout.vertical ? ctx.track.scrollTop : ctx.track.scrollLeft;

/** Scrolls straight to a position, ignoring `scroll-behavior` */
export const jump = (ctx: Context, value: number) => {
	if (ctx.destroyed) return;
	const { layout, track } = ctx;
	track.scrollTo(
		layout.vertical
			? { top: value, behavior: "instant" }
			: { left: layout.rtl ? -value : value, behavior: "instant" },
	);
};

/** Scrolls to a position, smoothly when the track's CSS asks for it */
export const scrollTo = (ctx: Context, value: number) => {
	if (ctx.destroyed) return;
	const { layout } = ctx;
	ctx.track.scrollTo(
		layout.vertical ? { top: value } : { left: layout.rtl ? -value : value },
	);
};

/** The page a navigation in progress is scrolling to, or `null` */
export const targetPage = (ctx: Context) => {
	if (!ctx.targetSlide) return null;
	const page = ctx.layout.slidePage[ctx.slides.indexOf(ctx.targetSlide)];
	return page === undefined ? null : page;
};

// ----------------------------------------------------------------
// Snapping

/** Turns snapping off while the library reorders or drags the slides, so the browser doesn't snap mid-way */
export const suspendSnap = (ctx: Context) => {
	ctx.held.hold("scroll-snap-type", "none");
};

/** Turns snapping back on once nothing is moving the track */
export const resumeSnap = (ctx: Context) => {
	if (ctx.targetSlide !== null || ctx.drag?.dragging) return;
	ctx.held.release("scroll-snap-type");
};
