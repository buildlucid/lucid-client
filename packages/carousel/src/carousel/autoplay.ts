import C from "../constants.js";

export type Autoplay = {
	/** Whether autoplay is on. It stays on while paused for a reason, such as hover. */
	readonly on: boolean;
	/** Turns autoplay on, at `delay` milliseconds between slides */
	start: (delay: number) => void;
	/** Turns autoplay off */
	stop: () => void;
	/** Holds autoplay for a reason, such as `hover`, until that reason is released */
	hold: (reason: string) => void;
	/** Lets autoplay carry on once nothing else holds it */
	release: (reason: string) => void;
	destroy: () => void;
};

/**
 * Autoplay's timer. Autoplay is on or off, which the visitor controls, and is
 * held while any reason to wait applies, such as the pointer being over it.
 * Each slide gets the full delay after autoplay resumes.
 */
const createAutoplay = (
	root: HTMLElement,
	tick: () => void,
	changed: () => void,
): Autoplay => {
	const reasons = new Set<string>();
	const abort = new AbortController();
	let on = false;
	let delay = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let watching = false;
	let visibility: IntersectionObserver | undefined;

	const schedule = () => {
		clearTimeout(timer);
		timer = undefined;
		if (!on || reasons.size > 0) return;
		timer = setTimeout(() => {
			timer = undefined;
			tick();
			schedule();
		}, delay);
	};

	const hold = (reason: string) => {
		if (reasons.has(reason)) return;
		reasons.add(reason);
		schedule();
	};
	const release = (reason: string) => {
		if (reasons.delete(reason)) schedule();
	};

	/**
	 * Holds autoplay while the page is hidden or the carousel is out of view.
	 * Set up the first time autoplay starts, so carousels that never play don't
	 * watch for either.
	 */
	const watch = () => {
		if (watching) return;
		watching = true;
		if (document.visibilityState === "hidden") reasons.add("hidden");
		document.addEventListener(
			"visibilitychange",
			() => {
				if (document.visibilityState === "hidden") hold("hidden");
				else release("hidden");
			},
			{ signal: abort.signal },
		);
		if (typeof IntersectionObserver !== "function") return;
		visibility = new IntersectionObserver((entries) => {
			const entry = entries[entries.length - 1];
			if (!entry) return;
			if (entry.isIntersecting) release("offscreen");
			else hold("offscreen");
		});
		visibility.observe(root);
	};

	return {
		get on() {
			return on;
		},
		start: (next) => {
			watch();
			delay = next;
			const was = on;
			on = true;
			schedule();
			if (!was) changed();
		},
		stop: () => {
			if (!on) return;
			on = false;
			schedule();
			changed();
		},
		hold,
		release,
		destroy: () => {
			clearTimeout(timer);
			timer = undefined;
			abort.abort();
			visibility?.disconnect();
		},
	};
};

/** Whether a `data-carousel--action` value starts or stops autoplay */
export const isAutoplayAction = (action: string | null) =>
	action === C.actions.toggle ||
	action === C.actions.play ||
	action === C.actions.pause;

export const prefersReducedMotion = () =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;

export default createAutoplay;
