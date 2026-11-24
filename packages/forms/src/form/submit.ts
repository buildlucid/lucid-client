import C from "../constants.js";
import log from "../lib/log.js";
import S from "../state.js";
import type { FormResult, FormResultDetail } from "../types.js";
import { writeStatus } from "./announce.js";
import { hasCaptcha, requestTokens, resetTokens } from "./captcha.js";
import { type Attempt, type Context, setState, setStatus } from "./context.js";
import { renderCounts } from "./count.js";
import {
	canFocus,
	formAttr,
	formElements,
	isControl,
	owned,
	requestSubmit,
	resetForm,
	textOf,
} from "./dom.js";
import { normaliseErrors, presentErrors, replaceErrors } from "./errors.js";
import { message } from "./messages.js";
import parse from "./parse.js";
import {
	buildRequest,
	readFormData,
	submitMode,
	submitNatively,
} from "./request.js";
import { checkFields, releaseValidity } from "./validate.js";

const A = C.attributes;

const emit = (
	ctx: Context,
	type: string,
	detail: unknown,
	cancelable = false,
) =>
	ctx.form.dispatchEvent(
		new CustomEvent(type, { bubbles: true, cancelable, detail }),
	);

/** Whether checks are run: not with `data-form--validate="off"`, or for a submitter with `formnovalidate` */
const runsChecks = (ctx: Context, submitter: HTMLElement | null) =>
	formAttr(ctx.form, A.validate) !== "off" &&
	submitter?.hasAttribute("formnovalidate") !== true;

/** Checks every field and shows their errors. Returns whether they all passed. */
export const validateForm = (ctx: Context, focus: boolean) => {
	replaceErrors(ctx, checkFields(ctx));
	const { errors } = ctx.state;
	if (Object.keys(errors).length === 0) return true;
	presentErrors(ctx, { focus });
	emit(ctx, C.events.invalid, { errors: { ...errors } });
	return false;
};

/**
 * Resets the form's values after a send, without treating it as the visitor's
 * reset, so the sent message stays
 */
const resetValues = (ctx: Context) => {
	releaseValidity(ctx, Array.from(ctx.validity.keys()));
	ctx.resetting = true;
	try {
		resetForm(ctx.form);
	} finally {
		ctx.resetting = false;
	}
	setState(ctx, { dirty: false });
	renderCounts(ctx);
};

const submitButtons = (ctx: Context) =>
	formElements(ctx.form).filter(
		(element): element is HTMLButtonElement | HTMLInputElement =>
			(element instanceof HTMLButtonElement && element.type === "submit") ||
			(element instanceof HTMLInputElement &&
				(element.type === "submit" || element.type === "image")),
	);

/**
 * Starts a send. Its submit buttons are marked `aria-disabled` rather than
 * `disabled`, so the one that was pressed keeps focus, and presses meanwhile
 * are ignored. Any earlier send is cancelled first.
 */
const startAttempt = (ctx: Context): Attempt => {
	cancelAttempt(ctx);
	const held = submitButtons(ctx).map(
		(button) => [button, button.getAttribute("aria-disabled")] as const,
	);
	for (const [button] of held) ctx.rec.attr(button, "aria-disabled", "true");
	let released = false;
	const attempt: Attempt = {
		controller: new AbortController(),
		release: () => {
			if (released || ctx.destroyed) return;
			released = true;
			for (const [button, value] of held)
				ctx.rec.attr(button, "aria-disabled", value);
		},
	};
	ctx.attempt = attempt;
	return attempt;
};

const finishAttempt = (ctx: Context, attempt: Attempt) => {
	if (ctx.attempt === attempt) ctx.attempt = null;
	attempt.release();
};

/** Stops the send in progress, such as when the form is reset or destroyed */
export const cancelAttempt = (ctx: Context) => {
	const attempt = ctx.attempt;
	if (!attempt) return;
	ctx.attempt = null;
	attempt.controller.abort();
	attempt.release();
};

/** Only follows links to web pages, so a response can't run script with a `javascript:` URL */
const safeRedirect = (redirect: string | null | undefined) => {
	if (!redirect) return null;
	try {
		const url = new URL(redirect, document.baseURI);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.href
			: null;
	} catch {
		return null;
	}
};

/**
 * Shows the `data-form--sent` elements and focuses the first, or else writes
 * the message to the status. Empty ones show the message, and keep showing
 * each new one.
 */
const showSent = (ctx: Context, text: string) => {
	const sent = owned(ctx, `[${A.sent}]`);
	const first = sent[0];
	if (!first) {
		writeStatus(ctx, text);
		return;
	}
	writeStatus(ctx, "");
	for (const element of sent) {
		if (ctx.filled.has(element) || textOf(element) === "") {
			ctx.rec.content(element, text);
			ctx.filled.add(element);
		}
		ctx.rec.attr(element, "hidden", null);
		ctx.rec.fallback(element, "tabindex", "-1");
	}
	first.focus();
};

/** Hides the `data-form--sent` elements, moving focus to the first field when it was inside one */
export const hideSent = (ctx: Context) => {
	let hadFocus = false;
	for (const element of owned(ctx, `[${A.sent}]`)) {
		if (element.contains(document.activeElement)) hadFocus = true;
		ctx.rec.attr(element, "hidden", "");
	}
	if (hadFocus)
		formElements(ctx.form)
			.find((element) => isControl(element) && canFocus(element))
			?.focus();
};

const succeed = (ctx: Context, detail: FormResultDetail) => {
	const { result } = detail;
	const text = result.message ?? message(ctx, "success");
	replaceErrors(ctx, {});
	setStatus(ctx, "success");
	setState(ctx, { message: text });
	resetTokens(ctx);

	const redirect =
		safeRedirect(result.redirect) ??
		safeRedirect(formAttr(ctx.form, A.redirect));
	if (redirect) {
		writeStatus(ctx, text);
		emit(ctx, C.events.success, detail);
		location.assign(redirect);
		return;
	}

	if (formAttr(ctx.form, A.reset) !== "false") resetValues(ctx);
	showSent(ctx, text);
	emit(ctx, C.events.success, detail);
};

const fail = (ctx: Context, detail: FormResultDetail) => {
	const { result } = detail;
	replaceErrors(ctx, normaliseErrors(result.errors ?? {}));
	setStatus(ctx, "error");
	const fieldErrors = Object.keys(ctx.state.errors).length > 0;
	const text =
		result.message ??
		(fieldErrors || ctx.general.length > 0 ? undefined : message(ctx, "error"));
	presentErrors(ctx, { message: text, focus: fieldErrors });
	resetTokens(ctx);
	emit(ctx, C.events.error, detail);
};

/**
 * Returns to idle after a send stops before sending. The status is only
 * cleared while it still says the form is sending, so a message a listener
 * wrote, such as with `setErrors`, stays.
 */
const stop = (ctx: Context, sending: string) => {
	setStatus(ctx, "idle");
	if (ctx.state.message !== sending) return;
	setState(ctx, { message: "" });
	writeStatus(ctx, "");
};

/**
 * Waits for captcha tokens, and checks the fields again when it had to wait,
 * as they may have changed meanwhile. Returns whether to go on.
 */
const prepare = async (ctx: Context, attempt: Attempt, check: boolean) => {
	const waited = await requestTokens(ctx, attempt.controller.signal);
	if (attempt.controller.signal.aborted) return false;
	if (!waited || !check || validateForm(ctx, true)) return true;
	setStatus(ctx, "idle");
	resetTokens(ctx);
	return false;
};

/**
 * Sends the form with `fetch`, or the `send` option, and shows the result.
 * Resolves with the result, or `null` when the send was cancelled, the form
 * was destroyed or its fields stopped passing their checks.
 */
export const send = async (
	ctx: Context,
	submitter: HTMLElement | null,
	check: boolean,
): Promise<FormResult | null> => {
	const attempt = startAttempt(ctx);
	const { signal } = attempt.controller;
	let sending = "";
	let response: Response | null = null;
	try {
		sending = message(ctx, "submitting");
		ctx.general = [];
		setStatus(ctx, "submitting");
		setState(ctx, { message: sending });
		writeStatus(ctx, sending);
		if (!(await prepare(ctx, attempt, check))) return null;

		const data = readFormData(ctx.form, submitter);
		const proceed = emit(ctx, C.events.submit, { data, submitter }, true);
		// A listener may have reset or destroyed the form, or started another send.
		if (signal.aborted) return null;
		if (!proceed) {
			stop(ctx, sending);
			resetTokens(ctx);
			return null;
		}

		const request = buildRequest(ctx.form, submitter, data, signal);
		const sent = S.settings.send
			? await S.settings.send(request, ctx.api)
			: await fetch(request);
		response = sent instanceof Response ? sent : null;
		const result =
			sent instanceof Response
				? await (S.settings.parse ?? parse)(sent, ctx.api)
				: sent;
		if (signal.aborted) return null;

		if (result.ok) succeed(ctx, { result, response });
		else fail(ctx, { result, response });
		return result;
	} catch (error) {
		if (signal.aborted) return null;
		log("error", "The form couldn't be sent.", error);
		const result: FormResult = { ok: false, message: message(ctx, "error") };
		fail(ctx, { result, response, error });
		return result;
	} finally {
		finishAttempt(ctx, attempt);
	}
};

/**
 * Waits for captcha tokens, then lets the browser submit the form itself.
 * Tokens are reset once the browser has read them, for forms that stay on the
 * page, such as ones that submit to an iframe.
 */
const sendNatively = async (
	ctx: Context,
	submitter: HTMLElement | null,
	check: boolean,
	coordinates: Array<[string, string]>,
) => {
	const attempt = startAttempt(ctx);
	try {
		setStatus(ctx, "submitting");
		if (!(await prepare(ctx, attempt, check))) return;
		setStatus(ctx, "idle");
		submitNatively(ctx.form, submitter, coordinates);
		resetTokens(ctx);
	} finally {
		finishAttempt(ctx, attempt);
	}
};

/**
 * The `name.x` and `name.y` an image button sends, from where it was pressed,
 * for a native submission that waits for a captcha. They are read from the
 * press, as building the form's data here would fire `formdata` a second time.
 */
const imageCoordinates = (
	ctx: Context,
	submitter: HTMLElement | null,
): Array<[string, string]> => {
	if (!(submitter instanceof HTMLInputElement) || submitter.type !== "image")
		return [];
	const pressed = ctx.pressed?.button === submitter ? ctx.pressed : null;
	const prefix = submitter.name ? `${submitter.name}.` : "";
	return [
		[`${prefix}x`, String(pressed?.x ?? 0)],
		[`${prefix}y`, String(pressed?.y ?? 0)],
	];
};

/**
 * Handles the form's `submit` event, once the page's own listeners have run.
 * A listener that calls `preventDefault()` takes the submission over, and the
 * form is left alone. Otherwise it is checked, then sent with `fetch`, or left
 * to the browser for native submissions.
 */
export const onSubmit = (ctx: Context, event: SubmitEvent) => {
	if (event.defaultPrevented) return;
	if (ctx.state.status === "submitting") {
		event.preventDefault();
		return;
	}
	const submitter =
		event.submitter instanceof HTMLElement ? event.submitter : null;
	const check = runsChecks(ctx, submitter);
	if (check && !validateForm(ctx, true)) {
		event.preventDefault();
		return;
	}
	if (submitMode(ctx.form, submitter) === "fetch") {
		event.preventDefault();
		void send(ctx, submitter, check);
		return;
	}
	// Native submissions only wait when a captcha needs to write its token first.
	if (!hasCaptcha(ctx)) return;
	event.preventDefault();
	void sendNatively(ctx, submitter, check, imageCoordinates(ctx, submitter));
};

/** Checks and sends the form from the API, as pressing its submit button does */
export const submitForm = async (ctx: Context) => {
	if (ctx.state.status === "submitting") return null;
	if (submitMode(ctx.form, null) === "native") {
		requestSubmit(ctx.form, null);
		return null;
	}
	const check = runsChecks(ctx, null);
	if (check && !validateForm(ctx, true)) return null;
	return send(ctx, null, check);
};
