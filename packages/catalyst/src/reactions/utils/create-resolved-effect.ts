import { createEffect, createMemo, onCleanup, untrack } from "solid-js";
import { runEffectCallback } from "../../runtime/reactive.js";
import type {
	Directive,
	MemberReference,
	ReactionContext,
} from "../../types/index.js";

type ResolvedEffectOptions = {
	/**
	 * Applies the initial value synchronously while the directive is set up,
	 * instead of when Catalyst next flushes. Loops use this so the markup they
	 * render exists before the rest of the sync runs.
	 */
	immediate?: boolean;
};

// The resolved value is boxed so Solid never sees a Promise returned from a
// compute. An action that returns a Promise would otherwise become an async
// computation and hold unrelated updates until it settles.
type Resolved = { value: unknown };

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
	typeof value === "object" &&
	value !== null &&
	"then" in value &&
	typeof value.then === "function";

const apply = (resolved: Resolved, onValue: (value: unknown) => void) => {
	if (!isPromiseLike(resolved.value)) {
		onValue(resolved.value);
		return undefined;
	}

	let active = true;
	void Promise.resolve(resolved.value)
		.then((value) => {
			if (!active) return;
			try {
				onValue(value);
			} catch (error) {
				console.error(error);
			}
		})
		.catch(console.error);
	return () => {
		active = false;
	};
};

const createResolvedEffect = (
	directive: Directive,
	context: ReactionContext,
	onValue: (value: unknown) => void,
	options?: ResolvedEffectOptions,
) => {
	const reference: MemberReference | null = directive.reference;
	if (!reference) {
		context.warn(
			`The "${directive.attributeName}" directive requires a state or action reference.`,
		);
		return;
	}

	const compute = (): Resolved => ({ value: context.resolve(reference) });
	const effect = {
		effect: (resolved: Resolved) =>
			runEffectCallback(() => apply(resolved, onValue)),
		error: (error: unknown) => {
			console.error(error);
		},
	};

	if (!options?.immediate) {
		createEffect(compute, effect);
		return;
	}

	const resolved = createMemo(compute, { equals: false });
	let initialCleanup: (() => void) | undefined;
	try {
		initialCleanup = apply(untrack(resolved), onValue);
	} catch (error) {
		console.error(error);
	}
	onCleanup(() => initialCleanup?.());
	createEffect(
		() => resolved(),
		{
			effect: (value: Resolved) => {
				initialCleanup?.();
				initialCleanup = undefined;
				return effect.effect(value);
			},
			error: effect.error,
		},
		{ defer: true },
	);
};

export default createResolvedEffect;
