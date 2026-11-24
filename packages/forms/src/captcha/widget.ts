import C from "../constants.js";
import log from "../lib/log.js";
import type { Extension } from "../types.js";

/** One captcha widget, drawn in one `data-form--captcha` element */
export type Widget = {
	/** Loads the provider and draws the widget, once */
	start: () => void;
	/** Resolves once the widget has written a fresh token, or the check failed so there won't be one */
	token: () => Promise<void>;
	/** Clears the token after a send, as each works once */
	reset: () => void;
	destroy: () => void;
};

const loading = new Map<string, Promise<void>>();

/**
 * Loads a provider's script once for every form on the page. A nonce from the
 * page's own scripts is copied, for Content Security Policies that use one.
 */
export const loadScript = (src: string) => {
	const existing = loading.get(src);
	if (existing) return existing;
	const promise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = src;
		script.async = true;
		const nonce =
			document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
		if (nonce) script.nonce = nonce;
		script.addEventListener("load", () => resolve(), { once: true });
		script.addEventListener(
			"error",
			() => {
				loading.delete(src);
				script.remove();
				reject(new Error(`${src} couldn't be loaded.`));
			},
			{ once: true },
		);
		document.head.append(script);
	});
	loading.set(src, promise);
	return promise;
};

/** Collects callbacks that wait for a token, and lets them all go at once */
export const createWaitlist = () => {
	let waiting: Array<() => void> = [];
	return {
		wait: () => new Promise<void>((resolve) => waiting.push(resolve)),
		release: () => {
			const done = waiting;
			waiting = [];
			for (const resolve of done) resolve();
		},
	};
};

/**
 * Makes an extension that draws a provider's widget in every
 * `data-form--captcha="{name}"` element, answering the form's `captcha:token`
 * and `captcha:reset` events. Widgets start when the form comes near the viewport or is first
 * used, so the provider's script doesn't slow the page down.
 */
export const defineCaptcha = (
	name: string,
	create: (slot: HTMLElement) => Widget | null,
): Extension => ({
	name,
	setup: (form, { owned, signal }) => {
		/** Each slot's widget, with the controller that removes its listeners */
		const widgets = new Map<
			HTMLElement,
			{ widget: Widget; listeners: AbortController }
		>();
		let started = false;

		const start = () => {
			if (started) return;
			started = true;
			observer?.disconnect();
			for (const { widget } of widgets.values()) widget.start();
		};

		const remove = (slot: HTMLElement) => {
			const entry = widgets.get(slot);
			if (!entry) return;
			entry.listeners.abort();
			entry.widget.destroy();
			widgets.delete(slot);
		};

		const scan = () => {
			const slots = owned(`[${C.attributes.captcha}="${name}"]`);
			for (const slot of Array.from(widgets.keys()))
				if (!slots.includes(slot)) remove(slot);
			for (const slot of slots) {
				if (widgets.has(slot)) continue;
				const widget = create(slot);
				if (!widget) continue;
				// Removed with the widget, and every widget is removed when the form is destroyed.
				const listeners = new AbortController();
				const options = { signal: listeners.signal };
				widgets.set(slot, { widget, listeners });
				slot.addEventListener(
					C.events.captchaToken,
					(event) => {
						const detail = (event as CustomEvent<unknown>).detail;
						if (typeof detail === "function") detail(widget.token());
					},
					options,
				);
				slot.addEventListener(
					C.events.captchaReset,
					() => widget.reset(),
					options,
				);
				if (started) widget.start();
			}
		};

		const observer =
			typeof IntersectionObserver === "function"
				? new IntersectionObserver(
						(entries) => {
							if (entries.some((entry) => entry.isIntersecting)) start();
						},
						{ rootMargin: "200px" },
					)
				: null;
		observer?.observe(form.element);
		for (const type of ["focusin", "pointerenter", "input"] as const)
			form.element.addEventListener(type, start, { once: true, signal });
		scan();

		return {
			refresh: scan,
			destroy: () => {
				observer?.disconnect();
				for (const slot of Array.from(widgets.keys())) remove(slot);
			},
		};
	},
});

/** Reads a slot's site key, warning when it has none */
export const siteKey = (slot: HTMLElement, provider: string) => {
	const key = slot.dataset.sitekey;
	if (!key)
		log(
			"warn",
			`A ${provider} captcha has no data-sitekey, so it was skipped.`,
		);
	return key || null;
};
