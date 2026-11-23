import { markReleased } from "../../runtime/released.js";
import { containsIgnored, syncTargets } from "../../runtime/sync.js";
import type { Reaction } from "../../types/index.js";
import createResolvedEffect from "../utils/create-resolved-effect.js";
import {
	getTemplate,
	getTemplateNodes,
	importNodes,
	removeUnmanagedChildren,
} from "../utils/template.js";

const isElement = (node: Node): node is Element =>
	node.nodeType === Node.ELEMENT_NODE;

/**
 * Renders the element's direct `<template>` child while the value is truthy,
 * and removes it, with its listeners, effects and stores, while it is falsy.
 */
const ifReaction: Reaction = {
	name: "conditional",
	attribute: "if",
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

		const templateNodes = getTemplateNodes(template);
		const ignored = containsIgnored(template.content);
		let rendered: ChildNode[] | null = null;
		let hasRendered = false;

		const show = () => {
			const nodes = importNodes(templateNodes);
			element.append(...nodes);
			rendered = nodes;
			syncTargets(nodes.filter(isElement), { ignored });
		};

		// Removed markup is disposed here, so it is marked to stop the removal
		// observer disposing it again.
		const hide = () => {
			for (const node of rendered ?? []) {
				if (!isElement(node)) continue;
				context.disposeSubtree(node);
				markReleased(node);
			}
			for (const node of rendered ?? []) node.remove();
			rendered = null;
		};

		createResolvedEffect(
			directive,
			context,
			(value) => {
				if (!hasRendered) {
					hasRendered = true;
					removeUnmanagedChildren(element, template, context.disposeSubtree);
				}
				if (value && !rendered) show();
				else if (!value && rendered) hide();
			},
			// Applied while the directive is set up, as loops are, so the markup
			// exists before the rest of the sync runs.
			{ immediate: true, read: (value) => Boolean(value), distinct: true },
		);

		return () => {
			context.disposeSubtree(element, { childrenOnly: true });
			rendered = null;
		};
	},
};

export default ifReaction;
