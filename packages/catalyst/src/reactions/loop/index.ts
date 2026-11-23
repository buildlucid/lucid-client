import { createSignal } from "solid-js";
import { getLoopContext, setLoopContext } from "../../runtime/loop-context.js";
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
			context.warn(
				`The "${directive.attributeName}" directive requires state or an action.`,
			);
			return;
		}

		const element = directive.element;
		const template = getTemplate(element);
		if (!template) {
			context.warn(
				`The "${directive.attributeName}" directive requires a direct template child.`,
			);
			return;
		}
		if (template.content.children.length !== 1) {
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

		const removeEntry = (entry: LoopEntry) => {
			context.disposeSubtree(entry.root);
			for (const node of entry.nodes) node.remove();
		};

		// Markup the loop did not render, such as server-rendered placeholders.
		const removeUnmanagedChildren = () => {
			for (const child of Array.from(element.childNodes)) {
				if (child === template) continue;
				if (child instanceof Element) context.disposeSubtree(child);
				child.remove();
			}
		};

		const placeEntries = (ordered: LoopEntry[]) => {
			const skipTemplate = (node: Node | null) =>
				node === template ? node.nextSibling : node;
			let cursor = skipTemplate(element.firstChild);
			for (const entry of ordered) {
				for (const node of entry.nodes) {
					if (node === cursor) {
						cursor = skipTemplate(node.nextSibling);
						continue;
					}
					element.insertBefore(node, cursor);
				}
			}
		};

		const render = (value: unknown) => {
			if (value !== null && value !== undefined && !Array.isArray(value)) {
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
			const created: LoopEntry[] = [];
			for (let index = 0; index < items.length; index += 1) {
				const item = items[index];
				const reused = available.get(item)?.shift();
				if (reused) {
					if (reused.position !== index) {
						reused.position = index;
						reused.setIndex(index);
					}
					next.push(reused);
					continue;
				}
				const entry = createEntry(item, index, parent);
				if (!entry) continue;
				next.push(entry);
				created.push(entry);
			}

			for (const unused of available.values()) {
				for (const entry of unused) removeEntry(entry);
			}

			placeEntries(next);
			entries = next;
			for (const entry of created) context.sync(entry.root);
		};

		createResolvedEffect(directive, context, render, {
			immediate: true,
			read: readItems,
		});

		return () => {
			for (const entry of entries) context.disposeSubtree(entry.root);
			entries = [];
		};
	},
};

export default loopReaction;
