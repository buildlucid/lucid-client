/**
 * Subtrees Catalyst disposed itself just before removing them, such as items a
 * loop removed, so the removal observer doesn't walk them a second time. A
 * sync could set up directives inside one before the observer runs, so a mark
 * only counts while no sync has run since it was made.
 */
let syncs = 0;
const released = new WeakMap<Element, number>();

export const noteSync = () => {
	syncs += 1;
};

/** Marks a disposed subtree that is about to be removed. */
export const markReleased = (root: Element) => {
	released.set(root, syncs);
};

/** Whether a removed subtree was disposed when it was removed. Clears its mark. */
export const takeReleased = (root: Element) => {
	const mark = released.get(root);
	if (mark === undefined) return false;
	released.delete(root);
	return mark === syncs;
};
