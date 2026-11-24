import log from "../lib/log.js";
import S, { type Instance } from "../state.js";
import type { ExtensionContext, Form } from "../types.js";
import { announce } from "./announce.js";
import { type Context, copyState, createContext } from "./context.js";
import { renderCounts } from "./count.js";
import { controlsOf, owned, resetForm } from "./dom.js";
import {
	normaliseErrors,
	presentErrors,
	renderAllErrors,
	replaceErrors,
	updateErrors,
} from "./errors.js";
import { handleEvent } from "./events.js";
import { prepareMarkup, readRenderedErrors } from "./markup.js";
import { message } from "./messages.js";
import { cancelAttempt, submitForm, validateForm } from "./submit.js";
import { checkField, releaseValidity } from "./validate.js";

/** Stops the form and puts back everything it changed in the markup */
const teardown = (ctx: Context) => {
	if (ctx.destroyed) return;
	cancelAttempt(ctx);
	ctx.destroyed = true;
	ctx.abort.abort();

	for (const extension of ctx.extensions) {
		try {
			extension.destroy?.();
		} catch (error) {
			log("error", "An extension threw an error while being destroyed.", error);
		}
	}
	ctx.extensions = [];

	for (const timer of ctx.countTimers.values()) clearTimeout(timer);
	for (const timer of ctx.liveTimers.values()) clearTimeout(timer);
	for (const nodes of ctx.summaryItems.values())
		for (const node of nodes) node.parentNode?.removeChild(node);
	ctx.announcer?.remove();

	// Custom validity set for the library's own checks would otherwise keep fields invalid.
	releaseValidity(ctx, Array.from(ctx.validity.keys()), true);

	ctx.rec.restore();
	ctx.rec.close();
	ctx.subscribers.clear();
};

/** Reads the markup again, picking up elements added since the form was enhanced */
const refresh = (ctx: Context) => {
	ctx.cache = null;
	prepareMarkup(ctx);
	updateErrors(ctx, readRenderedErrors(ctx));
	renderAllErrors(ctx);
	renderCounts(ctx);
	for (const extension of ctx.extensions) {
		try {
			extension.refresh?.();
		} catch (error) {
			log("error", "An extension threw an error while refreshing.", error);
		}
	}
};

const createApi = (ctx: Context, onDestroy: (form: Form) => void): Form => {
	/**
	 * Wraps a method so it does nothing once the form is destroyed, and reads
	 * the markup afresh, as it may have changed since the last call
	 */
	const live =
		<Args extends unknown[]>(method: (...args: Args) => void) =>
		(...args: Args) => {
			if (ctx.destroyed) return;
			ctx.cache = null;
			method(...args);
		};

	const api: Form = {
		element: ctx.form,
		get state() {
			return copyState(ctx.state);
		},
		submit: () => {
			if (ctx.destroyed) return Promise.resolve(null);
			ctx.cache = null;
			return submitForm(ctx);
		},
		validate: (name) => {
			if (ctx.destroyed) return false;
			ctx.cache = null;
			if (name === undefined) return validateForm(ctx, true);
			const messages = checkField(ctx, name, controlsOf(ctx, name));
			updateErrors(ctx, { [name]: messages });
			return messages.length === 0;
		},
		reset: live(() => resetForm(ctx.form)),
		setErrors: live((errors, options) => {
			ctx.general = [];
			updateErrors(ctx, normaliseErrors(errors));
			presentErrors(ctx, { focus: options?.focus ?? true });
		}),
		clearErrors: live((name) => {
			const fields =
				name === undefined ? Object.keys(ctx.state.errors) : [name];
			for (const field of fields) releaseValidity(ctx, controlsOf(ctx, field));
			if (name === undefined) replaceErrors(ctx, {});
			else updateErrors(ctx, { [name]: [] });
		}),
		subscribe: (listener) => {
			ctx.subscribers.add(listener);
			return () => {
				ctx.subscribers.delete(listener);
			};
		},
		refresh: live(() => refresh(ctx)),
		destroy: live(() => {
			teardown(ctx);
			onDestroy(api);
		}),
	};
	return api;
};

/** Runs every extension passed to `init` on the form */
const setupExtensions = (ctx: Context) => {
	const context: ExtensionContext = {
		signal: ctx.abort.signal,
		owned: (selector) => owned(ctx, selector),
		announce: (text) => announce(ctx, text),
		message,
	};
	for (const extension of S.settings.extensions) {
		try {
			const instance = extension.setup(ctx.api, context);
			if (instance) ctx.extensions.push(instance);
		} catch (error) {
			log("error", `The "${extension.name}" extension threw an error.`, error);
		}
	}
};

/**
 * Enhances one `data-form` element
 * - Errors already in the markup are linked to their fields
 * - `onDestroy` is told when the form is destroyed through its own API
 */
const createForm = (
	form: HTMLFormElement,
	onDestroy: (form: Form) => void,
): Instance => {
	const ctx = createContext(form);
	ctx.api = createApi(ctx, onDestroy);
	try {
		prepareMarkup(ctx);
		updateErrors(ctx, readRenderedErrors(ctx));
		renderCounts(ctx);
		setupExtensions(ctx);
	} catch (error) {
		// A half enhanced form would lose the browser's own checks, so it is put back as it was.
		teardown(ctx);
		throw error;
	}

	return {
		api: ctx.api,
		handle: (event) => handleEvent(ctx, event),
		teardown: () => teardown(ctx),
	};
};

export default createForm;
