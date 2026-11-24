import C from "../constants.js";
import type { Context } from "./context.js";
import { baseName, owned, textOf } from "./dom.js";

const A = C.attributes;

/**
 * Prepares the markup for the library, and is safe to run again on refresh
 * - The form gets `novalidate`, as the library shows the errors the browser would have shown in its own bubbles
 * - Status elements become polite live regions, so they are known to screen readers before anything is written
 * - Summaries and sent messages are hidden until they are needed, and can take focus
 * - Honeypot fields are kept out of the tab order and away from screen readers
 */
export const prepareMarkup = (ctx: Context) => {
	const { form, rec } = ctx;
	rec.attr(form, "novalidate", "");
	rec.attr(form, A.ready, "");
	rec.attr(form, A.state, ctx.state.status);

	for (const status of owned(ctx, `[${A.status}]`)) {
		if (!status.hasAttribute("role") && !status.hasAttribute("aria-live"))
			rec.attr(status, "role", "status");
		rec.fallback(status, "aria-atomic", "true");
	}

	for (const summary of owned(ctx, `[${A.summary}]`)) {
		rec.fallback(summary, "tabindex", "-1");
		if (Object.keys(ctx.state.errors).length === 0)
			rec.attr(summary, "hidden", "");
	}

	for (const sent of owned(ctx, `[${A.sent}]`)) {
		rec.fallback(sent, "tabindex", "-1");
		if (ctx.state.status !== "success") rec.attr(sent, "hidden", "");
	}

	for (const honeypot of owned(ctx, `[${A.honeypot}]`)) {
		rec.fallback(honeypot, "aria-hidden", "true");
		const controls = honeypot.matches("input, select, textarea")
			? [honeypot]
			: owned(ctx, `[${A.honeypot}] :is(input, select, textarea)`).filter(
					(control) => honeypot.contains(control),
				);
		for (const control of controls) {
			rec.attr(control, "tabindex", "-1");
			rec.fallback(control, "autocomplete", "off");
		}
	}
};

/**
 * Reads errors the server already wrote into the page, such as after a
 * submission without JavaScript, so they are linked to their fields and clear
 * once fixed. Empty error elements are hidden.
 */
export const readRenderedErrors = (ctx: Context) => {
	// A Map, so field names such as `__proto__` are keys like any other.
	const errors = new Map<string, string[]>();
	for (const element of owned(ctx, `[${A.error}]`)) {
		const name = baseName(element.getAttribute(A.error) ?? "");
		// The library already shows this field's errors.
		if (Object.hasOwn(ctx.state.errors, name)) continue;
		const text = textOf(element);
		if (name && text && !element.hidden)
			errors.set(name, [...(errors.get(name) ?? []), text]);
		else ctx.rec.attr(element, "hidden", "");
	}
	return Object.fromEntries(errors);
};
