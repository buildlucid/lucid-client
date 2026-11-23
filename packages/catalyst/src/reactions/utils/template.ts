/** A reaction's direct `<template>` child, which holds the markup it renders. */
export const getTemplate = (target: Element) =>
	Array.from(target.children).find(
		(element): element is HTMLTemplateElement =>
			element instanceof HTMLTemplateElement,
	);

/** Whitespace that includes a line break, such as a template's indentation. */
const isFormattingWhitespace = (node: Node) =>
	node.nodeType === Node.TEXT_NODE &&
	/^\s*$/.test(node.textContent ?? "") &&
	/[\n\r]/.test(node.textContent ?? "");

/**
 * The template's top-level nodes to render. Whitespace around its elements
 * that includes a line break is the template's indentation, so it isn't
 * rendered, as in Vue templates. Whitespace on one line, such as a space
 * between inline items, is kept.
 */
export const getTemplateNodes = (template: HTMLTemplateElement) =>
	Array.from(template.content.childNodes).filter(
		(node) => !isFormattingWhitespace(node),
	);

/**
 * Copies template nodes into the page's document. Imported rather than
 * cloned, so they needn't be adopted when they are inserted.
 */
export const importNodes = (nodes: Node[]) =>
	nodes.map((node) => document.importNode(node, true) as ChildNode);

/** Removes markup a reaction didn't render, such as server-rendered placeholders. */
export const removeUnmanagedChildren = (
	element: Element,
	template: HTMLTemplateElement,
	disposeSubtree: (target: Element) => void,
) => {
	for (const child of Array.from(element.childNodes)) {
		if (child === template) continue;
		if (child instanceof Element) disposeSubtree(child);
		child.remove();
	}
};
