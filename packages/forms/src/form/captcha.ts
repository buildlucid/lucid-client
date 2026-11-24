import C from "../constants.js";
import type { Context } from "./context.js";
import { owned } from "./dom.js";

const slots = (ctx: Context) => owned(ctx, `[${C.attributes.captcha}]`);

export const hasCaptcha = (ctx: Context) => slots(ctx).length > 0;

/**
 * Asks each captcha widget for a fresh token before sending, and waits for
 * them: each gets a `captcha:token` event whose `detail` takes a promise to
 * wait on. A widget that never answers
 * can't hold the form up past the timeout, after which the server refuses the
 * missing token with its own message. Stops waiting when the send is
 * cancelled. Returns whether any widget was waited for.
 */
export const requestTokens = async (ctx: Context, signal: AbortSignal) => {
	const pending: Promise<unknown>[] = [];
	for (const slot of slots(ctx)) {
		// A widget's listener may have reset the form while being asked, so the rest aren't asked.
		if (signal.aborted) break;
		slot.dispatchEvent(
			new CustomEvent(C.events.captchaToken, {
				detail: (wait: Promise<unknown>) => {
					// Handled straight away, so a widget that fails after the send stopped waiting isn't left unhandled.
					pending.push(Promise.resolve(wait).catch(() => {}));
				},
			}),
		);
	}
	if (pending.length === 0) return false;
	if (signal.aborted) return true;

	let timer: ReturnType<typeof setTimeout> | undefined;
	let stop = () => {};
	const giveUp = new Promise<void>((resolve) => {
		timer = setTimeout(resolve, C.captchaTimeout);
		stop = resolve;
		signal.addEventListener("abort", stop, { once: true });
	});
	await Promise.race([Promise.allSettled(pending), giveUp]);
	clearTimeout(timer);
	signal.removeEventListener("abort", stop);
	return true;
};

/** Tells each widget a send has finished, as tokens only work once */
export const resetTokens = (ctx: Context) => {
	for (const slot of slots(ctx))
		slot.dispatchEvent(new Event(C.events.captchaReset));
};
