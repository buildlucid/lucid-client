import { flushUpdates } from "../runtime/reactive.js";
import type { ViewTransitionOptions } from "../types/index.js";

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as { then?: unknown }).then === "function";

const prefersReducedMotion = () =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;

// Browsers that support view transitions without types only accept a callback.
const supportsTypes = () =>
	typeof ViewTransition === "function" && "types" in ViewTransition.prototype;

/**
 * Animates the page from how it looks now to how it looks after `update`
 * changes state, with the View Transition API. The changes `update` makes are
 * applied to the page before the browser captures the new state.
 *
 * Without browser support, or when the user prefers reduced motion, `update`
 * runs straight away without a transition and nothing is returned.
 */
const viewTransition = (
	update: () => void,
	options?: ViewTransitionOptions,
): ViewTransition | undefined => {
	const run = () => {
		try {
			// Only the changes made before an async update awaits are part of
			// the transition, but its rejection is still reported.
			const result: unknown = update();
			if (isPromiseLike(result)) Promise.resolve(result).catch(console.error);
		} catch (error) {
			console.error(error);
		}
		flushUpdates();
	};

	if (
		typeof document.startViewTransition !== "function" ||
		prefersReducedMotion()
	) {
		run();
		return undefined;
	}

	const types = options?.types;
	const transition =
		types?.length && supportsTypes()
			? document.startViewTransition({ update: run, types })
			: document.startViewTransition(run);
	// `ready` rejects when the animation is skipped, such as when another
	// transition starts, which isn't an error.
	transition.ready.catch(() => {});
	return transition;
};

export default viewTransition;
