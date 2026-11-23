import type {
	LoopMemberReference,
	LoopMemberReferenceKey,
	MemberReference,
	StoreMemberReference,
} from "../types/index.js";
import Catalyst from "./catalyst.js";
import { getLoopContext, type LoopContext } from "./loop-context.js";

const LOOP_REFERENCE_KEYS: LoopMemberReferenceKey[] = [
	"item",
	"index",
	"indexOne",
];

/**
 * Returns the scope of the nearest `data-store` ancestor. When that element is
 * a duplicate of a scope another element already owns, its directives are
 * left unscoped instead of silently binding to the other instance.
 */
const getNearestStoreScope = (element: Element) => {
	const attributeName = `${Catalyst.options.attributes.prefix}${Catalyst.options.attributes.store}`;
	let current: Element | null = element;
	while (current) {
		if (current.hasAttribute(attributeName)) {
			const scope = current.getAttribute(attributeName) || null;
			if (!scope) return null;
			const store = Catalyst.stores.get(scope);
			if (store && store.element !== current) return null;
			return scope;
		}
		current = current.parentElement;
	}
	return null;
};

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

const resolveDirectiveReference = (
	reference: MemberReference | null,
	element: Element,
): MemberReference | null => {
	if (!reference || reference.type === "loop") return reference;

	const loopContext = getLoopContext(element);
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

	const scope = getNearestStoreScope(element);
	return scope ? { ...withLoop, scope } : withLoop;
};

export default resolveDirectiveReference;
