import { stringifyState } from "../../helpers.js";

export type FieldElement =
	| HTMLInputElement
	| HTMLTextAreaElement
	| HTMLSelectElement;

export const isField = (element: Element): element is FieldElement =>
	element instanceof HTMLInputElement ||
	element instanceof HTMLTextAreaElement ||
	element instanceof HTMLSelectElement;

export const isCheckable = (element: Element): element is HTMLInputElement =>
	element instanceof HTMLInputElement &&
	(element.type === "checkbox" || element.type === "radio");

const isNumeric = (element: FieldElement) =>
	element instanceof HTMLInputElement &&
	(element.type === "number" || element.type === "range");

/** Nullish values render as empty text, and objects as JSON. */
export const toText = (value: unknown) =>
	value === null || value === undefined ? "" : stringifyState(value);

/**
 * Reads a field value while tracking it. Arrays become arrays of text, so a
 * multiple select or a group of checkboxes can be filled from them, and
 * adding or removing items updates the field. Other objects are serialised.
 */
export const readFieldValue = (value: unknown) => {
	if (Array.isArray(value)) return value.map(toText);
	if (typeof value === "object" && value !== null) return stringifyState(value);
	return value;
};

/**
 * Sets the value a field shows. A multiple select selects every option whose
 * value is in an array. A number field that already shows the number is left
 * alone, so typing `1.` isn't rewritten to `1`.
 */
export const setFieldValue = (element: FieldElement, value: unknown) => {
	if (element instanceof HTMLSelectElement && element.multiple) {
		const values = Array.isArray(value) ? value.map(toText) : [toText(value)];
		for (const option of Array.from(element.options)) {
			option.selected = values.includes(option.value);
		}
		return;
	}

	const text = toText(Array.isArray(value) ? stringifyState(value) : value);
	if (element.value === text) return;
	if (
		isNumeric(element) &&
		typeof value === "number" &&
		(element as HTMLInputElement).valueAsNumber === value
	) {
		return;
	}
	element.value = text;
};

/**
 * Calls `onChange` when a select's options change, such as when a loop
 * renders them, so the value can be applied once its option exists.
 */
export const observeOptions = (
	select: HTMLSelectElement,
	onChange: () => void,
) => {
	const observer = new MutationObserver(onChange);
	observer.observe(select, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ["value"],
	});
	return () => observer.disconnect();
};
