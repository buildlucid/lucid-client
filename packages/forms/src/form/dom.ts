import C from "../constants.js";
import S from "../state.js";
import type { Control } from "../types.js";
import type { Context } from "./context.js";

const A = C.attributes;

// A field named like a form property or method, such as `action`, `reset` or
// `dispatchEvent`, replaces it on the form, so anything that can run on the
// form is read or called through the form's prototypes.
const elements = Object.getOwnPropertyDescriptor(
	HTMLFormElement.prototype,
	"elements",
);
const connected = Object.getOwnPropertyDescriptor(
	Node.prototype,
	"isConnected",
);

/** Reads an attribute of the form, or of an element that may be the form, even when a field shares the method's name */
export const formAttr = (element: Element, name: string) =>
	Element.prototype.getAttribute.call(element, name);

/** Whether the form is still in a document */
export const formConnected = (form: HTMLFormElement) =>
	connected?.get?.call(form) === true;

/** Listens to an event on the form */
export const listen = <K extends keyof HTMLElementEventMap>(
	form: HTMLFormElement,
	type: K,
	listener: (event: HTMLElementEventMap[K]) => void,
	options?: AddEventListenerOptions,
) =>
	HTMLFormElement.prototype.addEventListener.call(
		form,
		type,
		listener as EventListener,
		options,
	);

/** Every control that belongs to the form, including ones outside it with a `form` attribute */
export const formElements = (form: HTMLFormElement): Element[] =>
	Array.from(
		(elements?.get?.call(form) as HTMLFormControlsCollection | undefined) ?? [],
	);

export const resetForm = (form: HTMLFormElement) =>
	HTMLFormElement.prototype.reset.call(form);

export const requestSubmit = (
	form: HTMLFormElement,
	submitter: HTMLElement | null,
) => HTMLFormElement.prototype.requestSubmit.call(form, submitter);

/** The elements inside the form that match a selector */
export const owned = <E extends Element = HTMLElement>(
	ctx: Context,
	selector: string,
) =>
	Array.from(
		Element.prototype.querySelectorAll.call(
			ctx.form,
			selector,
		) as NodeListOf<E>,
	);

/** A value from a record by its own key, so names such as `constructor` aren't read from the prototype */
export const own = <T>(record: Record<string, T>, key: string): T | undefined =>
	Object.hasOwn(record, key) ? record[key] : undefined;

/** A field's name without a trailing `[]` or index, so `topics[]`, `files.0` and `files[0]` match `topics` and `files` */
export const baseName = (name: string) =>
	name.replace(/(?:\[\d*\]|\.\d+)$/, "");

const BUTTON_TYPES = new Set(["submit", "reset", "button", "image"]);

/** Whether an element is a control the library checks, rather than a button or honeypot */
export const isControl = (element: unknown): element is Control => {
	const control =
		element instanceof HTMLInputElement
			? !BUTTON_TYPES.has(element.type)
			: element instanceof HTMLSelectElement ||
				element instanceof HTMLTextAreaElement;
	return control && (element as Control).closest(`[${A.honeypot}]`) === null;
};

/**
 * The field a control belongs to: its name without a trailing `[]` or index,
 * or its id when it has no name, such as an "I agree" checkbox that is checked
 * but not sent
 */
export const fieldKey = (ctx: Context, control: Control) =>
	baseName(control.name || ensureId(ctx, control, "field"));

/** The cache for the current pass, which is cleared once the pass ends */
const passCache = (ctx: Context) => {
	let cache = ctx.cache;
	if (!cache) {
		const created = { fields: null, elements: new Map() };
		ctx.cache = cache = created;
		queueMicrotask(() => {
			if (ctx.cache === created) ctx.cache = null;
		});
	}
	return cache;
};

/** The form's controls by field, in the order their fields first appear */
export const fieldsOf = (ctx: Context) => {
	const cache = passCache(ctx);
	if (cache.fields) return cache.fields;
	const fields = new Map<string, Control[]>();
	for (const element of formElements(ctx.form)) {
		if (!isControl(element)) continue;
		const key = fieldKey(ctx, element);
		const controls = fields.get(key);
		if (controls) controls.push(element);
		else fields.set(key, [element]);
	}
	cache.fields = fields;
	return fields;
};

/** The controls of one field */
export const controlsOf = (ctx: Context, name: string) =>
	fieldsOf(ctx).get(baseName(name)) ?? [];

/** The elements inside the form whose attribute names a field, such as its error elements */
export const fieldElements = (
	ctx: Context,
	attribute: string,
	name: string,
) => {
	const cache = passCache(ctx);
	let byField = cache.elements.get(attribute);
	if (!byField) {
		byField = new Map();
		for (const element of owned(ctx, `[${attribute}]`)) {
			const key = baseName(element.getAttribute(attribute) ?? "");
			const list = byField.get(key);
			if (list) list.push(element);
			else byField.set(key, [element]);
		}
		cache.elements.set(attribute, byField);
	}
	return byField.get(baseName(name)) ?? [];
};

/** The `data-form--field` wrapper of a field, if it has one */
export const wrapperOf = (ctx: Context, name: string) =>
	fieldElements(ctx, A.field, name)[0] ?? null;

/** Hides an element the library adds from sight while screen readers still read it */
export const VISUALLY_HIDDEN =
	"position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap";

/** Gives an element an id when it has none, and returns its id */
export const ensureId = (ctx: Context, element: Element, hint: string) => {
	if (!element.id) {
		const safe = hint.replace(/[^\w-]+/g, "-");
		ctx.rec.fallback(element, "id", `form-${++S.ids}-${safe}`);
	}
	return element.id;
};

/** An element's visible text, without content hidden from screen readers such as a required `*` */
export const textOf = (element: Element) => {
	const copy = element.cloneNode(true) as Element;
	for (const hidden of copy.querySelectorAll('[aria-hidden="true"]'))
		hidden.remove();
	return (copy.textContent ?? "")
		.replace(/\s+/g, " ")
		.replace(/[\s*:]+$/, "")
		.trim();
};

/** The label of a field: its fieldset's legend, its first control's label, or its name */
export const labelOf = (ctx: Context, name: string, controls: Control[]) => {
	const wrapper = wrapperOf(ctx, name);
	const legend =
		wrapper instanceof HTMLFieldSetElement
			? wrapper.querySelector(":scope > legend")
			: null;
	if (legend) return textOf(legend);
	const control = controls[0];
	const label = control?.labels?.[0];
	if (label) return textOf(label);
	return control?.getAttribute("aria-label") ?? name;
};

/** Writes `{token}` values into a template, leaving unknown tokens as they are */
export const fill = (
	template: string,
	tokens: Record<string, string | number | undefined>,
) =>
	template.replace(/\{(\w+)\}/g, (match, key: string) => {
		const value = tokens[key];
		return value === undefined ? match : String(value);
	});

/** Adds and removes ids in an attribute that lists them, such as `aria-describedby` */
export const setIdList = (
	ctx: Context,
	element: Element,
	attribute: string,
	add: string[],
	remove: string[],
) => {
	const ids = (element.getAttribute(attribute) ?? "")
		.split(/\s+/)
		.filter((id) => id && !remove.includes(id));
	for (const id of add) if (!ids.includes(id)) ids.push(id);
	ctx.rec.attr(element, attribute, ids.length > 0 ? ids.join(" ") : null);
};

/** Whether an element can take focus. Controls disabled by their fieldset match `:disabled` too. */
export const canFocus = (element: Element): element is HTMLElement =>
	element instanceof HTMLElement &&
	!element.matches(":disabled") &&
	!(element instanceof HTMLInputElement && element.type === "hidden") &&
	element.closest("[hidden], [inert]") === null;

/** Whether a control is a hidden input, such as a captcha's token, which nobody sees or focuses */
export const isHidden = (control: Control) =>
	control instanceof HTMLInputElement && control.type === "hidden";
