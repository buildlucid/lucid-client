import type { LoopContext, LoopItem } from "../types/index.js";

export type { LoopContext };

const loopContexts = new WeakMap<Element, LoopContext>();
const loopItems = new WeakMap<LoopContext, LoopItem>();

/** The public view of a loop context that actions receive. */
export const toLoopItem = (context: LoopContext): LoopItem => {
	const existing = loopItems.get(context);
	if (existing) return existing;
	const loopItem: LoopItem = {
		get item() {
			return context.item;
		},
		get index() {
			return context.index();
		},
		get indexOne() {
			return context.index() + 1;
		},
		get parent() {
			return context.parent ? toLoopItem(context.parent) : undefined;
		},
	};
	loopItems.set(context, loopItem);
	return loopItem;
};

export const setLoopContext = (element: Element, context: LoopContext) => {
	loopContexts.set(element, context);
};

export const getLoopContext = (element: Element) => {
	let current: Element | null = element;
	while (current) {
		const context = loopContexts.get(current);
		if (context) return context;
		current = current.parentElement;
	}
	return undefined;
};
