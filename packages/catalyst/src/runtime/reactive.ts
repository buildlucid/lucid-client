import {
	createRoot,
	flush,
	getOwner,
	runWithOwner,
	untrack,
	type Owner,
} from "solid-js";

/**
 * Solid 2 owns a `createRoot` by whatever owner is current, and refuses to
 * create an ownerless root inside an effect callback. Every Catalyst root is
 * therefore parented to one runtime owner, created when Catalyst starts. Roots
 * are still disposed individually; disposing the runtime owner is the final
 * sweep performed by `destroy`.
 */
let runtimeOwner: Owner | null = null;
let disposeRuntime: (() => void) | null = null;
let effectCallbackDepth = 0;

export const createRuntimeOwner = () => {
	if (runtimeOwner) return;
	disposeRuntime = runWithOwner(null, () =>
		createRoot((dispose) => {
			runtimeOwner = getOwner();
			return dispose;
		}),
	);
};

export const disposeRuntimeOwner = () => {
	const dispose = disposeRuntime;
	runtimeOwner = null;
	disposeRuntime = null;
	dispose?.();
};

/** Creates a root owned by the runtime rather than by the current owner. */
export const createOwnedRoot = <T>(fn: (dispose: () => void) => T): T => {
	if (!runtimeOwner) createRuntimeOwner();
	return runWithOwner(runtimeOwner, () => createRoot(fn));
};

/**
 * Runs user code with no owner and no tracking. Signal writes are only
 * permitted outside an owned scope, and nothing read here should subscribe
 * the caller.
 */
export const runUnowned = <T>(fn: () => T): T => runWithOwner(null, fn);

const logError = (error: unknown) => console.error(error);

/**
 * Runs an effect callback. Solid 2 halts the whole reactive system when an
 * effect callback throws or returns anything other than a cleanup function, so
 * every Catalyst effect callback is isolated here. Callbacks run untracked:
 * reading state in them is intended, so Solid's dev warning about untracked
 * reads doesn't apply. Errors from the callback and its cleanup go to `onError`.
 */
export const runEffectCallback = (
	fn: () => unknown,
	onError: (error: unknown) => void = logError,
): (() => void) | undefined => {
	effectCallbackDepth += 1;
	try {
		const cleanup = untrack(fn);
		if (typeof cleanup !== "function") return undefined;
		return () => {
			try {
				untrack(cleanup as () => unknown);
			} catch (error) {
				onError(error);
			}
		};
	} catch (error) {
		onError(error);
		return undefined;
	} finally {
		effectCallbackDepth -= 1;
	}
};

/**
 * Applies queued reactive updates synchronously so `start`, `sync` and
 * `refresh` leave the DOM bound when they return. Flushing is a no-op inside
 * an effect callback, so it is skipped there.
 */
export const flushUpdates = () => {
	if (effectCallbackDepth > 0) return;
	try {
		flush();
	} catch (error) {
		console.error(error);
	}
};

/**
 * Marks a first-party reaction whose setup creates no reactive computations,
 * such as events. Its directives skip the Solid root every other directive is
 * set up in, which saves creating and disposing one per directive. Custom
 * reactions always get a root.
 */
export const NO_ROOT = Symbol("catalyst.noRoot");
