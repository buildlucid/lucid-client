import { createSignal } from "solid-js";
import { getLoopContext, setLoopContext } from "../../runtime/loop-context.js";
import { markReleased } from "../../runtime/released.js";
import type { LoopContext, Reaction } from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";
import { readItems } from "../utils/read-value.js";

type LoopEntry = {
	item: unknown;
	root: Element;
	/** Every top-level node of the cloned template, moved as one unit. */
	nodes: ChildNode[];
	/** Mirrors the reactive index, so updates never read the signal. */
	position: number;
	setIndex: (index: number) => void;
};

/**
 * Flags the entries that are already in order, as the longest run of
 * increasing previous positions. Those stay where they are and the rest move,
 * so a reorder moves as few nodes as possible. `-1` marks a new entry.
 */
const findStableEntries = (previous: number[]) => {
	const stable = new Uint8Array(previous.length);
	// `tails[length]` ends the best run of `length + 1` entries found so far.
	const tails: number[] = [];
	const predecessors = new Int32Array(previous.length);
	for (let index = 0; index < previous.length; index += 1) {
		const position = previous[index] ?? -1;
		if (position < 0) continue;
		let low = 0;
		let high = tails.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if ((previous[tails[middle] ?? 0] ?? 0) < position) low = middle + 1;
			else high = middle;
		}
		predecessors[index] = low > 0 ? (tails[low - 1] ?? -1) : -1;
		tails[low] = index;
	}
	let index = tails.at(-1) ?? -1;
	while (index >= 0) {
		stable[index] = 1;
		index = predecessors[index] ?? -1;
	}
	return stable;
};

const getTemplate = (target: Element) =>
	Array.from(target.children).find(
		(element): element is HTMLTemplateElement =>
			element instanceof HTMLTemplateElement,
	);

const loopReaction: Reaction = {
	name: "loop",
	attribute: "loop",
	setup: (directive, context) => {
		if (directive.reference?.type === "identifier") {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires state or an action.`,
				);
			return;
		}

		const element = directive.element;
		const template = getTemplate(element);
		if (!template) {
			if (__DEV__)
				context.warn(
					`The "${directive.attributeName}" directive requires a direct template child.`,
				);
			return;
		}
		if (template.content.children.length !== 1) {
			if (__DEV__)
				context.warn("Loop templates must contain exactly one element child.");
			return;
		}

		let entries: LoopEntry[] = [];
		let hasRendered = false;
		// Items of `$item.links` belong to the same store as the outer loop's.
		const reference = directive.reference;
		const scope =
			reference?.type === "loop"
				? (reference.context?.scope ?? null)
				: (reference?.scope ?? null);

		const createEntry = (
			item: unknown,
			index: number,
			parent: LoopContext | undefined,
		): LoopEntry | null => {
			const fragment = template.content.cloneNode(true) as DocumentFragment;
			const root = fragment.firstElementChild;
			if (!root) return null;

			const [getIndex, setIndex] = createSignal(index);
			setLoopContext(root, { item, index: getIndex, parent, scope });
			return {
				item,
				root,
				nodes: Array.from(fragment.childNodes),
				position: index,
				setIndex: (next) => setIndex(next),
			};
		};

		// Removed items are disposed here, so they are marked to stop the removal
		// observer disposing them again.
		const removeEntry = (entry: LoopEntry) => {
			context.disposeSubtree(entry.root);
			markReleased(entry.root);
			for (const node of entry.nodes) node.remove();
		};

		/**
		 * Removes every rendered item at once: one walk disposes them, and when
		 * the element holds nothing else but its template, one call removes them.
		 */
		const removeAllEntries = () => {
			if (entries.length === 0) return;
			context.disposeSubtree(element, { childrenOnly: true });
			let nodeCount = 0;
			for (const entry of entries) {
				markReleased(entry.root);
				nodeCount += entry.nodes.length;
			}
			if (element.childNodes.length === nodeCount + 1) {
				element.replaceChildren(template);
			} else {
				for (const entry of entries) {
					for (const node of entry.nodes) node.remove();
				}
			}
			entries = [];
		};

		// Markup the loop did not render, such as server-rendered placeholders.
		const removeUnmanagedChildren = () => {
			for (const child of Array.from(element.childNodes)) {
				if (child === template) continue;
				if (child instanceof Element) context.disposeSubtree(child);
				child.remove();
			}
		};

		/**
		 * Puts entries in order after the template, moving only those that
		 * aren't already in order. `previous` holds each entry's position before
		 * this render, or `-1` for a new one. Entries that move together are
		 * inserted as one fragment.
		 */
		const placeEntries = (ordered: LoopEntry[], previous: number[]) => {
			const stable = findStableEntries(previous);
			let anchor: ChildNode | null = null;
			let moving: LoopEntry[] = [];
			const insertMoving = () => {
				if (moving.length === 0) return;
				const fragment = document.createDocumentFragment();
				for (let index = moving.length - 1; index >= 0; index -= 1) {
					fragment.append(...(moving[index]?.nodes ?? []));
				}
				element.insertBefore(fragment, anchor);
				moving = [];
			};
			for (let index = ordered.length - 1; index >= 0; index -= 1) {
				const entry = ordered[index];
				if (!entry) continue;
				if (!stable[index]) {
					moving.push(entry);
					continue;
				}
				insertMoving();
				anchor = entry.nodes[0] ?? anchor;
			}
			insertMoving();
		};

		const render = (value: unknown) => {
			if (value !== null && value !== undefined && !Array.isArray(value)) {
				if (__DEV__)
					context.warn(
						`The "${directive.attributeName}" directive must resolve to an array.`,
					);
				return;
			}
			const items: unknown[] = Array.isArray(value) ? value : [];

			if (!hasRendered) {
				hasRendered = true;
				removeUnmanagedChildren();
			}
			if (items.length === 0) {
				removeAllEntries();
				return;
			}

			// Items are matched by identity, so unchanged items keep their markup,
			// state and listeners, and only their index updates.
			const available = new Map<unknown, LoopEntry[]>();
			for (const entry of entries) {
				const matches = available.get(entry.item);
				if (matches) matches.push(entry);
				else available.set(entry.item, [entry]);
			}

			const parent = getLoopContext(element);
			const next: LoopEntry[] = [];
			const previous: number[] = [];
			const created: LoopEntry[] = [];
			for (let index = 0; index < items.length; index += 1) {
				const item = items[index];
				const reused = available.get(item)?.shift();
				if (reused) {
					previous.push(reused.position);
					if (reused.position !== index) {
						reused.position = index;
						reused.setIndex(index);
					}
					next.push(reused);
					continue;
				}
				const entry = createEntry(item, index, parent);
				if (!entry) continue;
				previous.push(-1);
				next.push(entry);
				created.push(entry);
			}

			if (created.length === next.length) {
				removeAllEntries();
			} else {
				for (const unused of available.values()) {
					for (const entry of unused) removeEntry(entry);
				}
			}

			placeEntries(next, previous);
			entries = next;
			for (const entry of created) context.sync(entry.root);
		};

		createResolvedEffect(directive, context, render, {
			immediate: true,
			read: readItems,
		});

		return () => {
			context.disposeSubtree(element, { childrenOnly: true });
			entries = [];
		};
	},
};

export default loopReaction;
