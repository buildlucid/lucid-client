import C from "../constants.js";
import { announce } from "./announce.js";
import { type Context, warnOnce } from "./context.js";
import { baseName, controlsOf, ensureId, owned, setIdList } from "./dom.js";
import { message } from "./messages.js";

const A = C.attributes;

/** A field's limit: its `maxlength`, which stops typing, or `data-form--maxlength`, which allows going over with an error */
const limitOf = (control: Element) => {
	for (const attribute of ["maxlength", A.maxlength]) {
		const limit = Number.parseInt(control.getAttribute(attribute) ?? "", 10);
		if (limit > 0) return limit;
	}
	return 0;
};

/**
 * Writes a `data-form--count` element's text, such as `You have 20 characters
 * remaining`, and describes its field with it, so the count is read when the
 * field is focused. While typing, the count is announced once typing pauses,
 * as GOV.UK's character count does, so screen readers aren't interrupted on
 * every key.
 */
const renderCount = (ctx: Context, element: HTMLElement, typed: boolean) => {
	const name = element.getAttribute(A.count) ?? "";
	const control = controlsOf(ctx, name).find(
		(candidate) =>
			candidate instanceof HTMLTextAreaElement ||
			candidate instanceof HTMLInputElement,
	);
	if (!control) {
		warnOnce(ctx, `The "${name}" character count has no field to count.`);
		return;
	}
	const limit = limitOf(control);
	if (limit === 0) {
		warnOnce(
			ctx,
			`The "${name}" character count needs a maxlength or data-form--maxlength on its field.`,
		);
		return;
	}

	const remaining = limit - control.value.length;
	const text = message(remaining < 0 ? "over" : "remaining", {
		count: Math.abs(remaining),
		limit,
	});
	ctx.rec.content(element, text);
	ctx.rec.attr(element, A.over, remaining < 0 ? "" : null);
	setIdList(
		ctx,
		control,
		"aria-describedby",
		[ensureId(ctx, element, `${name}-count`)],
		[],
	);

	if (!typed) return;
	clearTimeout(ctx.countTimers.get(element));
	ctx.countTimers.set(
		element,
		setTimeout(() => {
			ctx.countTimers.delete(element);
			if (!ctx.destroyed) announce(ctx, element.textContent ?? "");
		}, C.countDelay),
	);
};

/**
 * Writes the character counts of one field, or of every field
 * - `typed` announces them once typing pauses
 */
export const renderCounts = (ctx: Context, name?: string, typed = false) => {
	const base = name === undefined ? undefined : baseName(name);
	for (const element of owned(ctx, `[${A.count}]`)) {
		if (
			base !== undefined &&
			baseName(element.getAttribute(A.count) ?? "") !== base
		)
			continue;
		renderCount(ctx, element, typed);
	}
};
