import type { MemberReference, ReactionContext } from "../../types/index.js";

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as { then?: unknown }).then === "function";

/**
 * Calls an action with `argument`, such as an `Event`. Errors are logged, and
 * an async action's rejection is reported like a thrown error.
 */
const callAction = (
	reference: MemberReference,
	argument: unknown,
	context: ReactionContext,
) => {
	try {
		const result = context.resolve(reference, [argument]);
		if (isPromiseLike(result)) Promise.resolve(result).catch(console.error);
	} catch (error) {
		console.error(error);
	}
};

export default callAction;
