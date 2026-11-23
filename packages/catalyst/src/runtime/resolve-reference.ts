import { evaluatePathValue } from "../helpers.js";
import type { LoopMemberReference, MemberReference } from "../types/index.js";
import Catalyst from "./catalyst.js";
import { warn } from "./log.js";
import { toLoopItem } from "./loop-context.js";

const resolveLoopValue = (reference: LoopMemberReference) => {
	const context = reference.context;
	if (!context) return undefined;
	switch (reference.key) {
		case "item":
			return context.item;
		case "index":
			return context.index();
		case "indexOne":
			return context.index() + 1;
	}
};

const resolveReference = (reference: MemberReference, args: unknown[] = []) => {
	if (reference.type === "loop") {
		const value = resolveLoopValue(reference);
		return reference.path.length
			? evaluatePathValue(value, reference.path)
			: value;
	}

	if (!reference.scope) {
		if (__DEV__)
			warn(`Cannot infer a store for the reference "${reference.raw}".`);
		return undefined;
	}

	const store = Catalyst.stores.get(reference.scope);
	if (!store) {
		if (__DEV__)
			warn(`Cannot find a store with the scope "${reference.scope}".`);
		return undefined;
	}

	if (reference.type === "state") {
		if (!(reference.key in store.state)) {
			if (__DEV__)
				warn(
					`Cannot find state "${reference.key}" on store "${reference.scope}".`,
				);
			return undefined;
		}

		const value = store.state[reference.key];
		return reference.path.length
			? evaluatePathValue(value, reference.path)
			: value;
	}

	if (reference.type === "action") {
		const action = store.actions[reference.key];
		if (!action) {
			if (__DEV__)
				warn(
					`Cannot find action "${reference.key}" on store "${reference.scope}".`,
				);
			return undefined;
		}
		return reference.loop
			? action(...args, toLoopItem(reference.loop))
			: action(...args);
	}

	return reference.key;
};

export default resolveReference;
