import C from "../constants.js";
import { type Context, warnOnce } from "./context.js";
import { owned } from "./dom.js";

/** Hides the library's own live region from sight while screen readers still read it */
const VISUALLY_HIDDEN =
	"position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap";

/**
 * Writes a message to a live region. A message the same as the one showing is
 * cleared first and written again a moment later, so screen readers read it
 * again rather than ignoring an unchanged region.
 */
const writeLive = (
	ctx: Context,
	region: Element,
	text: string,
	write: (text: string) => void,
) => {
	clearTimeout(ctx.liveTimers.get(region));
	ctx.liveTimers.delete(region);
	if (text !== "" && region.textContent === text) {
		write("");
		ctx.liveTimers.set(
			region,
			setTimeout(() => {
				ctx.liveTimers.delete(region);
				if (!ctx.destroyed) write(text);
			}, C.repeatDelay),
		);
		return;
	}
	write(text);
};

/**
 * Reads a message out to screen readers without showing it, through a
 * visually hidden live region the library adds to the form the first time
 */
export const announce = (ctx: Context, text: string) => {
	const created = ctx.announcer === null;
	const region = ctx.announcer ?? document.createElement("div");
	const write = (value: string) => {
		region.textContent = value;
	};
	if (!created) {
		writeLive(ctx, region, text, write);
		return;
	}

	region.setAttribute("aria-live", "polite");
	region.setAttribute("aria-atomic", "true");
	region.style.cssText = VISUALLY_HIDDEN;
	Element.prototype.append.call(ctx.form, region);
	ctx.announcer = region;
	// A live region is only read once screen readers know of it, so a new one waits before its first message.
	ctx.liveTimers.set(
		region,
		setTimeout(() => {
			ctx.liveTimers.delete(region);
			if (!ctx.destroyed) write(text);
		}, C.repeatDelay),
	);
};

/**
 * Writes the form's status to its `data-form--status` elements. Without one,
 * the message is still announced, and a warning explains where to show it.
 */
export const writeStatus = (ctx: Context, text: string) => {
	// Any other message replaces the count of answers to fix, which stops being kept up to date.
	ctx.counting = false;
	const regions = owned(ctx, `[${C.attributes.status}]`);
	if (regions.length === 0) {
		if (text === "") return;
		warnOnce(
			ctx,
			"A form has no data-form--status element, so its messages are announced but not shown.",
		);
		announce(ctx, text);
		return;
	}
	for (const region of regions)
		writeLive(ctx, region, text, (value) => ctx.rec.content(region, value));
};
