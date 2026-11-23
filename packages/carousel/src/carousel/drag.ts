import C from "../constants.js";
import type { Context } from "./context.js";
import { clamp, nearestPage } from "./layout.js";
import { centre } from "./loop.js";
import { go } from "./navigation.js";
import { update } from "./render.js";
import { position, resumeSnap, suspendSnap } from "./scroll.js";
import { interrupt } from "./settle.js";

const A = C.attributes;

export type Drag = {
	/** Whether a press has become a drag and not yet been released */
	readonly dragging: boolean;
};

type DragHooks = {
	enabled: () => boolean;
	vertical: () => boolean;
	start: () => void;
	/** Runs after each move, and returns how far a loop rotation moved `scrollLeft` or `scrollTop` */
	move: () => number;
	/** Runs on release, with the drag's speed in `scrollLeft` or `scrollTop` pixels per millisecond */
	end: (velocity: number) => void;
};

/** Elements a press inside should keep for themselves, such as selecting text in a field */
const IGNORE =
	'input, textarea, select, option, [contenteditable]:not([contenteditable="false"])';

/** How far back samples are kept to measure the release speed, in milliseconds */
const SAMPLE_WINDOW = 100;

/** The fastest release counted, in pixels per millisecond */
const MAX_VELOCITY = 4;

// ----------------------------------------------------------------
// Pointer handling

/**
 * Drags the track with a mouse. Touch and pens already scroll natively, so they
 * are left alone. The press only becomes a drag once the pointer moves past
 * the threshold, so clicks on links and buttons inside slides still work, and
 * the click that ends a drag is swallowed.
 */
const registerDrag = (
	track: HTMLElement,
	signal: AbortSignal,
	hooks: DragHooks,
): Drag => {
	let press: {
		id: number;
		x: number;
		y: number;
		left: number;
		top: number;
	} | null = null;
	let dragging = false;
	let samples: Array<{ time: number; position: number }> = [];

	const swallowClick = () => {
		const swallow = (event: Event) => {
			event.preventDefault();
			event.stopPropagation();
		};
		window.addEventListener("click", swallow, {
			capture: true,
			once: true,
			signal,
		});
		// The click follows pointerup in the same task, so anything later isn't the drag's click.
		setTimeout(
			() => window.removeEventListener("click", swallow, { capture: true }),
			0,
		);
	};

	/** Ends a press, for the pointer it started with, or for any pointer when `id` is `null` */
	const finish = (id: number | null, now: number, cancelled: boolean) => {
		if (!press || (id !== null && id !== press.id)) return;
		const pointer = press.id;
		press = null;
		if (!dragging) return;
		dragging = false;
		if (track.hasPointerCapture(pointer)) track.releasePointerCapture(pointer);

		const recent = samples.filter(
			(sample) => now - sample.time <= SAMPLE_WINDOW,
		);
		samples = [];
		const first = recent[0];
		const last = recent[recent.length - 1];
		// At least a frame apart, and capped, so a few events close together can't fling across every slide.
		const velocity =
			!cancelled && first && last && first !== last
				? clamp(
						(last.position - first.position) /
							Math.max(last.time - first.time, 16),
						-MAX_VELOCITY,
						MAX_VELOCITY,
					)
				: 0;
		hooks.end(velocity);
		if (!cancelled) swallowClick();
	};

	track.addEventListener(
		"pointerdown",
		(event) => {
			if (!hooks.enabled() || event.pointerType !== "mouse") return;
			if (event.button !== 0) return;
			if (event.target instanceof Element && event.target.closest(IGNORE))
				return;
			press = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				left: track.scrollLeft,
				top: track.scrollTop,
			};
		},
		{ signal },
	);

	track.addEventListener(
		"pointermove",
		(event) => {
			if (!press || event.pointerId !== press.id) return;
			// The button was let go somewhere the pointerup wasn't seen, such as outside the window.
			if ((event.buttons & 1) === 0) {
				finish(event.pointerId, event.timeStamp, false);
				return;
			}
			const vertical = hooks.vertical();
			const dx = event.clientX - press.x;
			const dy = event.clientY - press.y;
			if (!dragging) {
				if (Math.abs(vertical ? dy : dx) < C.dragThreshold) return;
				dragging = true;
				samples = [];
				track.setPointerCapture(event.pointerId);
				window.getSelection()?.removeAllRanges();
				hooks.start();
			}
			event.preventDefault();
			// Physical scroll values follow the pointer the same way in either direction.
			if (vertical) track.scrollTop = press.top - dy;
			else track.scrollLeft = press.left - dx;
			const shift = hooks.move();
			if (shift !== 0) {
				// A loop rotation moved the scroll position without the pointer moving, so the samples move with it.
				if (vertical) press.top += shift;
				else press.left += shift;
				for (const sample of samples) sample.position += shift;
			}
			samples.push({
				time: event.timeStamp,
				position: vertical ? track.scrollTop : track.scrollLeft,
			});
			if (samples.length > 20) samples.shift();
		},
		{ signal },
	);

	// Listened for on the window too, in case pointer capture is lost or never taken.
	window.addEventListener(
		"pointerup",
		(event) => finish(event.pointerId, event.timeStamp, false),
		{ capture: true, signal },
	);
	window.addEventListener(
		"pointercancel",
		(event) => finish(event.pointerId, event.timeStamp, true),
		{ capture: true, signal },
	);
	// Switching windows mid-drag means the release won't be seen.
	window.addEventListener("blur", () => finish(null, performance.now(), true), {
		signal,
	});
	track.addEventListener(
		"lostpointercapture",
		(event) => finish(event.pointerId, event.timeStamp, false),
		{ signal },
	);

	// Stops links and images inside slides being dragged out of the page instead.
	track.addEventListener(
		"dragstart",
		(event) => {
			if (hooks.enabled()) event.preventDefault();
		},
		{ signal },
	);

	return {
		get dragging() {
			return dragging;
		},
	};
};

// ----------------------------------------------------------------
// The carousel's side of a drag

/** How long a release carries on for at the speed it was let go, in milliseconds */
const FLICK_TIME = 150;

/** The release speed, in pixels per millisecond, that always moves on a page */
const FLICK_SPEED = 0.2;

/**
 * Sets up mouse dragging the first time the options turn it on. Turning the
 * option off again only disables it.
 */
export const setUpDrag = (ctx: Context) => {
	const { held, rec, root } = ctx;
	/** The page the drag started on */
	let from = 0;

	ctx.drag ??= registerDrag(ctx.track, ctx.abort.signal, {
		enabled: () => ctx.config.drag && ctx.state.scrollable,
		vertical: () => ctx.layout.vertical,

		start: () => {
			from = ctx.state.index;
			interrupt(ctx);
			suspendSnap(ctx);
			held.hold("scroll-behavior", "auto");
			held.hold("user-select", "none");
			held.hold("-webkit-user-select", "none");
			rec.attr(root, A.dragging, "");
		},

		// While looping, the slides are rotated under the pointer near either end, so the drag can keep going.
		move: () => {
			if (!ctx.looping) return 0;
			const { layout } = ctx;
			const scroll = position(ctx);
			const edge = layout.client / 2;
			if (scroll > edge && scroll < layout.max - edge) return 0;
			const anchor = layout.pages[nearestPage(layout, scroll)]?.slide;
			return anchor === undefined ? 0 : centre(ctx, anchor);
		},

		// Settles on the page nearest where the drag would carry on to, or one on from where it started after a quick flick.
		end: (physicalVelocity) => {
			const velocity = ctx.layout.rtl ? -physicalVelocity : physicalVelocity;
			rec.attr(root, A.dragging, null);
			held.release("scroll-behavior");
			held.release("user-select");
			held.release("-webkit-user-select");
			update(ctx);

			let target = nearestPage(
				ctx.layout,
				position(ctx) + velocity * FLICK_TIME,
			);
			if (target === from && Math.abs(velocity) > FLICK_SPEED)
				target = from + Math.sign(velocity);
			go(ctx, target, "user", ctx.looping ? Math.sign(velocity) : 0);
			if (ctx.targetSlide === null) resumeSnap(ctx, false);
		},
	});
};
