import type { Page } from "playwright";

/**
 * Runs in the page, so it can't use anything from this module. Serialises the
 * DOM inside `selector` as a browser would show it, so libraries that write
 * different directive attributes still compare equal.
 *
 * Only `class`, `hidden` and `aria-*` attributes are kept, because those are
 * what the pages change. Templates, comments and whitespace are dropped, class
 * order is ignored, an empty class is the same as none, and `hidden` only
 * counts as present or absent.
 */
const serialise = (selector: string) => {
	const escape = (text: string) =>
		text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const attribute = ({ name, value }: Attr) => {
		if (name === "hidden") return " hidden";
		if (name === "class") {
			const classes = value.split(/\s+/).filter(Boolean).sort().join(" ");
			return classes ? ` class="${classes}"` : "";
		}
		return name.startsWith("aria-") ? ` ${name}="${escape(value)}"` : "";
	};
	const walk = (node: Node): string => {
		if (node.nodeType === Node.TEXT_NODE) {
			return escape((node.textContent ?? "").replace(/\s+/g, " ").trim());
		}
		if (!(node instanceof Element)) return "";
		const tag = node.tagName.toLowerCase();
		if (tag === "template" || tag === "script") return "";
		const attributes = Array.from(node.attributes, attribute).sort().join("");
		const children = Array.from(node.childNodes, walk).join("");
		return `<${tag}${attributes}>${children}</${tag}>`;
	};
	const root = document.querySelector(selector);
	if (!root) throw new Error(`Nothing matches "${selector}"`);
	return walk(root);
};

/** The DOM inside `selector`, reduced to what the check compares. */
export const snapshot = (page: Page, selector: string) =>
	page.evaluate(serialise, selector);

/** Describes where two snapshots first differ, or returns `null` if they match. */
export const difference = (expected: string, actual: string) => {
	if (expected === actual) return null;
	let index = 0;
	while (expected[index] === actual[index]) index++;
	const start = Math.max(0, index - 80);
	return `expected …${expected.slice(start, index + 80)}…\n     got …${actual.slice(start, index + 80)}…`;
};
