import C from "../constants.js";
import { writeStatus } from "./announce.js";
import { resetTokens } from "./captcha.js";
import { type Context, setState, setStatus } from "./context.js";
import { renderCounts } from "./count.js";
import {
	baseName,
	canFocus,
	controlsOf,
	fieldKey,
	fieldsOf,
	formAttr,
	isControl,
} from "./dom.js";
import { focusControl, replaceErrors, updateErrors } from "./errors.js";
import { cancelAttempt, hideSent, onSubmit } from "./submit.js";
import { checkField, releaseValidity } from "./validate.js";

const A = C.attributes;

/** The fields to check again after a field changes: itself, and the fields that must match it */
const dependents = (ctx: Context, name: string) => {
	const names = [name];
	for (const [other, controls] of fieldsOf(ctx)) {
		if (other === name) continue;
		if (
			controls.some(
				(control) => baseName(control.getAttribute(A.match) ?? "") === name,
			)
		)
			names.push(other);
	}
	return names;
};

/**
 * Checks fields again after a change
 * - `all` checks them whether or not they show an error, for `data-form--validate="change"`
 * - Otherwise only fields already showing an error are checked, so an error clears as soon as it's fixed, but none appear while someone is still typing
 */
const recheck = (ctx: Context, name: string, all: boolean) => {
	const changes = new Map<string, string[]>();
	for (const field of dependents(ctx, name)) {
		const shown = Object.hasOwn(ctx.state.errors, field);
		if (!shown && !(all && field === name)) continue;
		changes.set(field, checkField(ctx, field, controlsOf(ctx, field)));
	}
	if (changes.size > 0) updateErrors(ctx, Object.fromEntries(changes));
};

const onEdit = (ctx: Context, event: Event) => {
	const control = event.target;
	if (!isControl(control)) return;
	const name = fieldKey(ctx, control);
	setState(ctx, { dirty: true });
	if (event.type === "input") renderCounts(ctx, name, true);

	const mode = formAttr(ctx.form, A.validate);
	if (mode === "off") return;
	recheck(ctx, name, event.type === "change" && mode === "change");
};

/**
 * A reset from the visitor, such as a reset button, clears the errors, the
 * status and the sent message. Values are reset after the event, so counts
 * are written again afterwards.
 */
const onReset = (ctx: Context, event: Event) => {
	if (ctx.resetting || event.defaultPrevented) return;
	cancelAttempt(ctx);
	// Captcha widgets start again, so a check still running for the old values can't hand over its token.
	resetTokens(ctx);
	releaseValidity(ctx, Array.from(ctx.validity.keys()));
	replaceErrors(ctx, {});
	setStatus(ctx, "idle");
	setState(ctx, { message: "", dirty: false });
	writeStatus(ctx, "");
	hideSent(ctx);
	setTimeout(() => {
		if (!ctx.destroyed) renderCounts(ctx);
	}, 0);
};

/** Links in an error summary move focus to their field, rather than only scrolling to it */
const onClick = (ctx: Context, event: Event) => {
	if (event.defaultPrevented || !(event.target instanceof Element)) return;
	// Where an image button is pressed is sent with it. A keyboard press sends 0, 0.
	const target = event.target;
	if (target instanceof HTMLInputElement && target.type === "image") {
		const pointer = event instanceof MouseEvent && event.detail > 0;
		ctx.pressed = {
			button: target,
			x: pointer ? Math.max(0, Math.round(event.offsetX)) : 0,
			y: pointer ? Math.max(0, Math.round(event.offsetY)) : 0,
		};
		return;
	}
	const link = event.target.closest("a[href^='#']");
	if (!link?.closest(`[${A.summary}]`)) return;
	let id = "";
	try {
		id = decodeURIComponent(link.getAttribute("href")?.slice(1) ?? "");
	} catch {
		return;
	}
	const control = document.getElementById(id);
	if (!isControl(control) || control.form !== ctx.form) return;
	event.preventDefault();
	// A control that can't take focus, such as a hidden radio, hands it to another in its field.
	const others = controlsOf(ctx, fieldKey(ctx, control));
	for (const candidate of [control, ...others])
		if (canFocus(candidate) && focusControl(ctx, candidate)) return;
};

/** Runs the handler for an event routed to this form from the document */
export const handleEvent = (ctx: Context, event: Event) => {
	if (ctx.destroyed) return;
	ctx.cache = null;
	switch (event.type) {
		case "submit":
			onSubmit(ctx, event as SubmitEvent);
			break;
		case "input":
		case "change":
			onEdit(ctx, event);
			break;
		case "reset":
			onReset(ctx, event);
			break;
		case "click":
			onClick(ctx, event);
			break;
	}
};
