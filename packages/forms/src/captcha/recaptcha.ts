import {
	createWaitlist,
	defineCaptcha,
	loadScript,
	pageLanguage,
	siteKey,
} from "./widget.js";

type RecaptchaApi = {
	ready: (callback: () => void) => void;
	render: (container: HTMLElement, params: Record<string, unknown>) => number;
	reset: (widgetId?: number) => void;
	execute: (
		widgetOrKey?: number | string,
		options?: { action?: string },
	) => PromiseLike<string> | void;
	getResponse: (widgetId?: number) => string;
};

declare global {
	interface Window {
		grecaptcha?: RecaptchaApi & { enterprise?: RecaptchaApi };
	}
}

const FIELD = "g-recaptcha-response";

/**
 * Google reCAPTCHA. Pass it to `init`, and add a
 * `data-form--captcha="recaptcha"` element with your `data-sitekey`:
 * `forms.init({ extensions: [recaptcha] })`
 * - Checkbox keys show the "I'm not a robot" box, and a send waits until it is ticked
 * - `data-size="invisible"` runs an invisible check when the form is sent
 * - `data-score` is for v3 and score based keys, which get a token with `data-action` on every send
 * - `data-enterprise` uses reCAPTCHA Enterprise
 * - `data-language` sets its language, which otherwise follows the page's `lang`. The script loads once, so the first widget on the page sets it
 * - The token is sent as `g-recaptcha-response`, or the name in `data-response-field-name`
 */
export const recaptcha = defineCaptcha("recaptcha", (slot) => {
	const sitekey = siteKey(slot, "reCAPTCHA");
	if (!sitekey) return null;
	const { dataset } = slot;
	const score = slot.hasAttribute("data-score");
	const enterprise = slot.hasAttribute("data-enterprise");
	const invisible = dataset.size === "invisible";
	const field = dataset.responseFieldName || FIELD;
	const base = enterprise
		? "https://www.google.com/recaptcha/enterprise.js"
		: "https://www.google.com/recaptcha/api.js";
	const language = dataset.language || pageLanguage(slot);
	const src = `${base}?render=${score ? encodeURIComponent(sitekey) : "explicit"}${language ? `&hl=${encodeURIComponent(language)}` : ""}`;
	/** reCAPTCHA once it has loaded. Its shape is checked, as an element with `id="grecaptcha"` is also `window.grecaptcha`. */
	const apiOf = () => {
		const api = enterprise ? window.grecaptcha?.enterprise : window.grecaptcha;
		return typeof api?.ready === "function" ? api : undefined;
	};

	const waitlist = createWaitlist();
	let api: RecaptchaApi | null = null;
	let widgetId: number | null = null;
	let container: HTMLElement | null = null;
	let input: HTMLInputElement | null = null;
	let ready: Promise<void> | null = null;
	let destroyed = false;
	/** Counts score token requests */
	let requests = 0;

	/** A hidden input for the token: always for score keys, which draw nothing, and for a field name of your own */
	const tokenInput = () => {
		if (!input) {
			input = document.createElement("input");
			input.type = "hidden";
			input.name = field;
			slot.append(input);
		}
		return input;
	};

	const load = async () => {
		if (!apiOf()) await loadScript(src);
		const loaded = apiOf();
		if (!loaded) throw new Error("reCAPTCHA didn't load.");
		await new Promise<void>((resolve) => loaded.ready(resolve));
		return loaded;
	};

	const start = () => {
		ready ??= load()
			.then((loaded) => {
				if (destroyed) return;
				api = loaded;
				if (score) {
					tokenInput();
					return;
				}
				container = document.createElement("div");
				slot.append(container);
				const params: Record<string, unknown> = {
					sitekey,
					theme: dataset.theme,
					size: dataset.size,
					badge: dataset.badge,
					callback: (token: string) => {
						if (destroyed) return;
						if (field !== FIELD) tokenInput().value = token;
						waitlist.release();
					},
					"expired-callback": () => {
						if (input) input.value = "";
					},
					"error-callback": () => {
						if (!destroyed) waitlist.release();
					},
				};
				if (enterprise && dataset.action) params.action = dataset.action;
				for (const key of Object.keys(params))
					if (params[key] === undefined) delete params[key];
				widgetId = loaded.render(container, params);
			})
			// Sent without a token, which the server refuses with its own message. The next send loads it again.
			.catch(() => {
				ready = null;
				waitlist.release();
			});
		return ready;
	};

	return {
		start: () => void start(),
		token: async () => {
			await start();
			if (!api) return;
			if (score) {
				// Only the latest request writes its token, so one that finished late can't replace a newer one.
				const request = ++requests;
				tokenInput().value = "";
				let token = "";
				try {
					token =
						(await api.execute(sitekey, {
							action: dataset.action ?? "submit",
						})) ?? "";
				} catch {}
				if (!destroyed && request === requests) tokenInput().value = token;
				return;
			}
			if (widgetId === null || api.getResponse(widgetId)) return;
			const waiting = waitlist.wait();
			if (invisible) void api.execute(widgetId);
			// The send waits for the box to be ticked, so focus moves to it for keyboard and screen reader users.
			else container?.querySelector("iframe")?.focus();
			await waiting;
		},
		reset: () => {
			requests++;
			if (input) input.value = "";
			if (api && widgetId !== null) api.reset(widgetId);
		},
		destroy: () => {
			destroyed = true;
			waitlist.release();
			// Google asks for a checkbox to be reset before its markup is removed.
			if (api && widgetId !== null) {
				try {
					api.reset(widgetId);
				} catch {}
			}
			container?.remove();
			input?.remove();
		},
	};
});
