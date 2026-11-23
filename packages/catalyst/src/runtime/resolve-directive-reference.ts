import type {
	LoopMemberReference,
	LoopMemberReferenceKey,
	MemberReference,
	StoreMemberReference,
} from "../types/index.js";
import type { LoopContext } from "./loop-context.js";

const LOOP_REFERENCE_KEYS: LoopMemberReferenceKey[] = [
	"item",
	"index",
	"indexOne",
];

const resolveLoopReference = (
	reference: StoreMemberReference,
	context: LoopContext,
): LoopMemberReference | null => {
	if (reference.type !== "state") return null;

	const parts = [reference.key, ...reference.path];
	let targetContext: LoopContext | undefined = context;
	while (parts[0] === "parent") {
		targetContext = targetContext?.parent;
		parts.shift();
	}

	const key = parts.shift();
	if (!key || !LOOP_REFERENCE_KEYS.includes(key as LoopMemberReferenceKey)) {
		return null;
	}

	return {
		raw: reference.raw,
		scope: null,
		type: "loop",
		key: key as LoopMemberReferenceKey,
		path: parts,
		context: targetContext,
	};
};

/**
 * Resolves a parsed reference for its element: `$item` and `$index` refer to
 * the element's loop item, actions inside a loop receive that item, and
 * references without a scope belong to the nearest store, `scope`.
 */
const resolveDirectiveReference = (
	reference: MemberReference | null,
	loopContext: LoopContext | undefined,
	scope: string | null,
): MemberReference | null => {
	if (!reference || reference.type === "loop") return reference;

	// Actions inside a loop receive the item their element was rendered for.
	const withLoop: StoreMemberReference =
		loopContext && reference.type === "action"
			? { ...reference, loop: loopContext }
			: reference;
	if (withLoop.scope) return withLoop;

	if (loopContext) {
		const loopReference = resolveLoopReference(withLoop, loopContext);
		if (loopReference) return loopReference;
	}

	return scope ? { ...withLoop, scope } : withLoop;
};

export default resolveDirectiveReference;
