import C from "../constants.js";
import type { Control } from "../types.js";
import { writeStatus } from "./announce.js";
import { type Context, setState, warnOnce } from "./context.js";
import {
	baseName,
	canFocus,
	controlsOf,
	ensureId,
	fieldElements,
	fieldKey,
	fieldsOf,
	fill,
	isHidden,
	labelOf,
	owned,
	setIdList,
	VISUALLY_HIDDEN,
	wrapperOf,
} from "./dom.js";
import { message } from "./messages.js";

const A = C.attributes;

/** Errors keyed by field name, merging names such as `files.0` and `files.1` into their field */
export const normaliseErrors = (errors: Record<string, string | string[]>) => {
	// A Map, so field names such as `__proto__` are keys like any other.
	const result = new Map<string, string[]>();
	for (const [name, value] of Object.entries(errors)) {
		const messages = (Array.isArray(value) ? value : [value]).filter(
			(text): text is string => typeof text === "string" && text !== "",
		);
		if (messages.length === 0) continue;
		const key = baseName(name);
		result.set(key, [...(result.get(key) ?? []), ...messages]);
	}
	return Object.fromEntries(result);
};

/** Whether the form has anywhere to show a field's errors: its controls or its error elements */
const hasField = (ctx: Context, name: string) =>
	controlsOf(ctx, name).length > 0 ||
	fieldElements(ctx, A.error, name).length > 0;

const sameMessages = (a: string[] = [], b: string[] = []) =>
	a.length === b.length && a.every((text, index) => text === b[index]);

/**
 * Updates the error ids in an element's `aria-describedby`, removing ones the
 * library added earlier that the field no longer has, such as after its error
 * element was replaced
 */
const describe = (
	ctx: Context,
	name: string,
	recipients: Element[],
	ids: string[],
) => {
	const previous = ctx.described.get(name) ?? new Map<Element, string[]>();
	const next = new Map<Element, string[]>();
	// Elements that no longer describe the field, such as after it moved into a fieldset, lose their ids too.
	for (const [element, added] of previous)
		if (!recipients.includes(element))
			setIdList(ctx, element, "aria-describedby", [], added);
	for (const element of recipients) {
		const added = previous.get(element) ?? [];
		const present = (element.getAttribute("aria-describedby") ?? "").split(
			/\s+/,
		);
		// Only ids the library added are tracked, so ones the markup already had are never removed.
		const adding = ids.filter((id) => !present.includes(id));
		const keeping = added.filter((id) => ids.includes(id));
		setIdList(
			ctx,
			element,
			"aria-describedby",
			adding,
			added.filter((id) => !ids.includes(id)),
		);
		const owned = [...keeping, ...adding];
		if (owned.length > 0) next.set(element, owned);
	}
	if (next.size > 0) ctx.described.set(name, next);
	else ctx.described.delete(name);
};

const unmark = (ctx: Context, element: Element) => {
	if (element.hasAttribute("aria-invalid"))
		ctx.rec.attr(element, "aria-invalid", null);
	if (element.hasAttribute(A.invalid)) ctx.rec.attr(element, A.invalid, null);
};

/**
 * An error's text, after a visually hidden prefix such as "Error:" so screen
 * readers say what it is when it is read as the field's description
 */
const prefixed = (prefix: string, text: string): Array<Node | string> => {
	if (!prefix) return [text];
	const hidden = document.createElement("span");
	hidden.style.cssText = VISUALLY_HIDDEN;
	hidden.textContent = `${prefix} `;
	return [hidden, text];
};

/**
 * Shows or clears one field's messages: its error elements, `aria-invalid`,
 * `aria-describedby` and its wrapper's `data-form--invalid`. Hidden inputs,
 * such as a captcha's token, are left alone as nobody sees or focuses them.
 */
const renderField = (ctx: Context, name: string, messages: string[]) => {
	const { rec } = ctx;
	const invalid = messages.length > 0;
	const controls = controlsOf(ctx, name).filter(
		(control) => !isHidden(control),
	);
	const errors = fieldElements(ctx, A.error, name);
	const wrappers = fieldElements(ctx, A.field, name);

	const ids: string[] = [];
	for (const element of errors) {
		ids.push(ensureId(ctx, element, `${name}-error`));
		const prefix = message(ctx, "errorPrefix", {}, element);
		if (
			element instanceof HTMLUListElement ||
			element instanceof HTMLOListElement
		) {
			rec.content(
				element,
				...messages.map((text) => {
					const item = document.createElement("li");
					item.append(...prefixed(prefix, text));
					return item;
				}),
			);
		} else rec.content(element, ...prefixed(prefix, messages.join(" ")));
		rec.attr(element, "hidden", invalid ? null : "");
	}

	// A group is described on its fieldset, which screen readers read on entering it.
	const fieldset = wrappers.find(
		(wrapper) => wrapper instanceof HTMLFieldSetElement,
	);
	describe(ctx, name, fieldset ? [fieldset] : controls, invalid ? ids : []);
	// Elements marked before that no longer belong to the field, such as a renamed control, are cleared.
	const marking: Element[] = [...controls, ...wrappers];
	const elsewhere = new Set(
		Array.from(ctx.marked)
			.filter(([field]) => field !== name)
			.flatMap(([, elements]) => elements),
	);
	for (const element of ctx.marked.get(name) ?? [])
		if (!marking.includes(element) && !elsewhere.has(element))
			unmark(ctx, element);
	for (const control of controls)
		rec.attr(control, "aria-invalid", invalid ? "true" : null);
	for (const wrapper of wrappers)
		rec.attr(wrapper, A.invalid, invalid ? "" : null);
	if (invalid) ctx.marked.set(name, marking);
	else ctx.marked.delete(name);

	if (__DEV__ && invalid && errors.length === 0)
		warnOnce(
			ctx,
			`The "${name}" field has no data-form--error element, so its errors only show in the error summary or the status.`,
		);
};

/** The fields with errors, in the order they appear in the form */
export const orderedErrors = (ctx: Context) => Object.entries(ctx.state.errors);

/** The summaries that show, leaving out ones hidden with `hidden` or with CSS, such as on small screens */
const shownSummaries = (ctx: Context) =>
	owned(ctx, `[${A.summary}]`).filter(
		(summary) => !summary.hidden && summary.checkVisibility?.() !== false,
	);

const hasVisibleSummary = (ctx: Context) => shownSummaries(ctx).length > 0;

/** Fills every `{token}` in a template's text and attributes */
const fillNodes = (root: DocumentFragment, values: Record<string, string>) => {
	const walker = document.createTreeWalker(
		root,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
	);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node instanceof Text) {
			node.data = fill(node.data, values);
			continue;
		}
		for (const attribute of (node as Element).attributes)
			attribute.value = fill(attribute.value, values);
	}
};

/**
 * Lists the errors in each `data-form--summary`, cloning its `<template>` once
 * per message with `{message}`, `{id}` (the control to link to), `{name}` and
 * `{label}`. Summaries with no errors are hidden.
 * - A template inside a list owns that list, so items the server rendered there are replaced rather than repeated
 */
export const renderSummaries = (ctx: Context) => {
	const entries = orderedErrors(ctx);
	for (const summary of owned(ctx, `[${A.summary}]`)) {
		for (const node of ctx.summaryItems.get(summary) ?? [])
			node.parentNode?.removeChild(node);
		ctx.summaryItems.delete(summary);

		const template = summary.querySelector("template");
		const items: Node[] = [];
		for (const [name, messages] of template ? entries : []) {
			const controls = controlsOf(ctx, name);
			const target =
				controls.find(canFocus) ??
				controls[0] ??
				fieldElements(ctx, A.error, name)[0];
			const id = target ? ensureId(ctx, target, name) : "";
			const label = labelOf(ctx, name, controls);
			for (const text of messages) {
				const fragment = template?.content.cloneNode(true) as DocumentFragment;
				fillNodes(fragment, { message: text, id, name, label });
				items.push(...Array.from(fragment.childNodes));
			}
		}

		const list = template?.parentElement;
		if (template && list && list !== summary) {
			ctx.rec.content(list, ...items, template);
		} else if (template) {
			template.before(...items);
			ctx.summaryItems.set(summary, items);
		}
		ctx.rec.attr(summary, "hidden", entries.length > 0 ? null : "");
		ctx.rec.fallback(summary, "tabindex", "-1");
	}
};

/**
 * The status text for errors: a lead message, then, without a summary,
 * errors with nowhere of their own to show, such as a captcha's, then
 * messages that belong to no field
 */
const statusText = (ctx: Context, lead: string, hasSummary: boolean) => {
	const unplaced = hasSummary
		? []
		: orderedErrors(ctx)
				.filter(([name]) => fieldElements(ctx, A.error, name).length === 0)
				.flatMap(([, messages]) => messages);
	return [lead, ...unplaced, ...ctx.general].filter(Boolean).join(" ");
};

const writeErrorStatus = (ctx: Context, text: string, counting: boolean) => {
	setState(ctx, { message: text });
	writeStatus(ctx, text);
	ctx.counting = counting;
};

/** Keeps the library's count of answers to fix in the status up to date as they are fixed */
const updateCount = (ctx: Context) => {
	if (!ctx.counting) return;
	const count = Object.keys(ctx.state.errors).length;
	const hasSummary = hasVisibleSummary(ctx);
	const lead =
		count > 0 && !hasSummary ? message(ctx, "invalid", { count }) : "";
	writeErrorStatus(ctx, statusText(ctx, lead, hasSummary), lead !== "");
};

/**
 * Sets the errors of the fields named, leaving the others as they are. An
 * empty list clears a field's errors. Messages for names the form has no
 * field for are kept as general messages for the status.
 */
export const updateErrors = (
	ctx: Context,
	changes: Record<string, string[]>,
) => {
	// A Map, so field names such as `__proto__` are keys like any other.
	const errors = new Map(Object.entries(ctx.state.errors));
	let changed = false;
	for (const [rawName, messages] of Object.entries(changes)) {
		const name = baseName(rawName);
		if (messages.length > 0 && !hasField(ctx, name)) {
			ctx.general.push(...messages);
			continue;
		}
		if (sameMessages(errors.get(name), messages)) continue;
		changed = true;
		renderField(ctx, name, messages);
		if (messages.length > 0) errors.set(name, messages);
		else errors.delete(name);
	}
	// Checking a field as it is typed in mostly finds the same errors, which needn't be written again.
	if (!changed) return;

	// Kept in the order the fields appear, so subscribers and summaries list them as the form does.
	const ordered = new Map<string, string[]>();
	for (const name of fieldsOf(ctx).keys()) {
		const messages = errors.get(name);
		if (messages) ordered.set(name, messages);
	}
	for (const [name, messages] of errors) ordered.set(name, messages);
	setState(ctx, { errors: Object.fromEntries(ordered) });
	ctx.rec.attr(ctx.form, A.invalid, errors.size > 0 ? "" : null);
	renderSummaries(ctx);
	updateCount(ctx);
};

/** Replaces every field's errors */
export const replaceErrors = (
	ctx: Context,
	errors: Record<string, string[]>,
) => {
	ctx.general = [];
	const changes = new Map<string, string[]>();
	for (const name of Object.keys(ctx.state.errors)) changes.set(name, []);
	for (const [name, messages] of Object.entries(errors))
		changes.set(name, messages);
	updateErrors(ctx, Object.fromEntries(changes));
};

/** Writes every field's errors to the markup again, such as after a refresh */
export const renderAllErrors = (ctx: Context) => {
	for (const [name, messages] of Object.entries(ctx.state.errors))
		renderField(ctx, name, messages);
	renderSummaries(ctx);
};

/** Whether an element is wholly inside the viewport */
const inViewport = (element: Element) => {
	const box = element.getBoundingClientRect();
	const inside = (area: {
		top: number;
		left: number;
		bottom: number;
		right: number;
	}) =>
		box.top >= area.top &&
		box.left >= area.left &&
		box.bottom <= area.bottom &&
		box.right <= area.right;
	if (!inside({ top: 0, left: 0, bottom: innerHeight, right: innerWidth }))
		return false;
	// A scrolling panel can hide an element that is inside the viewport.
	for (
		let parent = element.parentElement;
		parent;
		parent = parent.parentElement
	) {
		const { overflowX, overflowY } = getComputedStyle(parent);
		if (overflowX === "visible" && overflowY === "visible") continue;
		if (!inside(parent.getBoundingClientRect())) return false;
	}
	return true;
};

/**
 * Focuses an element and, when it or `view` isn't already wholly in view,
 * scrolls `view` to the middle of the viewport, or to its top when it is
 * taller than the viewport. Scrolling is smooth unless the visitor prefers
 * reduced motion. Returns whether it took focus.
 */
const focusInView = (element: HTMLElement, view: Element = element) => {
	element.focus({ preventScroll: true });
	if (document.activeElement !== element) return false;
	if (inViewport(view) && inViewport(element)) return true;
	const tall = view.getBoundingClientRect().height > window.innerHeight;
	const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	view.scrollIntoView({
		block: tall ? "start" : "center",
		behavior: reduce ? "auto" : "smooth",
	});
	return true;
};

/**
 * Moves focus to a control, bringing its question into view with it, as
 * GOV.UK's error summary does: a group's legend for a radio or checkbox, or
 * else the control's label. Returns whether it took focus.
 */
export const focusControl = (ctx: Context, control: Control) => {
	const wrapper = wrapperOf(ctx, fieldKey(ctx, control));
	const legend =
		wrapper instanceof HTMLFieldSetElement
			? wrapper.querySelector(":scope > legend")
			: null;
	const grouped =
		control instanceof HTMLInputElement &&
		(control.type === "radio" || control.type === "checkbox");
	const question = (grouped ? legend : null) ?? control.labels?.[0] ?? null;
	// The question comes into view with the control, unless they are too far apart to both fit.
	const fits =
		question !== null &&
		control.getBoundingClientRect().bottom -
			question.getBoundingClientRect().top <=
			innerHeight;
	return focusInView(control, question && fits ? question : control);
};

/** Moves focus to the first visible error summary, or else the first control with an error that takes focus */
const focusErrors = (ctx: Context) => {
	// A summary that can't take focus, such as one inside an inert element, leaves it to the next, then the fields.
	for (const summary of shownSummaries(ctx)) if (focusInView(summary)) return;
	for (const [name] of orderedErrors(ctx)) {
		for (const control of controlsOf(ctx, name)) {
			if (canFocus(control) && focusControl(ctx, control)) return;
		}
	}
};

/**
 * Shows the outcome of a failed check or send. The status gets the message,
 * or the `invalid` count when there is no summary to list the errors, and
 * focus moves to the errors.
 */
export const presentErrors = (
	ctx: Context,
	options: { message?: string; focus: boolean },
) => {
	const count = Object.keys(ctx.state.errors).length;
	const hasSummary = hasVisibleSummary(ctx);
	const counting = options.message === undefined && count > 0 && !hasSummary;
	const lead =
		options.message ?? (counting ? message(ctx, "invalid", { count }) : "");
	writeErrorStatus(ctx, statusText(ctx, lead, hasSummary), counting);
	if (options.focus) focusErrors(ctx);
};
