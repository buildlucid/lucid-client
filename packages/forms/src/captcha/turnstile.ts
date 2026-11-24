import {
	createWaitlist,
	defineCaptcha,
	loadScript,
	pageLanguage,
	siteKey,
} from "./widget.js";

const SCRIPT =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
	render: (
		container: HTMLElement,
		params: Record<string, unknown>,
	) => string | null | undefined;
	reset: (widgetId: string) => void;
	remove: (widgetId: string) => void;
	getResponse: (widgetId: string) => string | undefined;
	isExpired: (widgetId: string) => boolean;
};

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

/**
 * Whether Turnstile has loaded. Its shape is checked, as an element with
 * `id="turnstile"` is also `window.turnstile`.
 */
const loaded = () =>
	typeof window.turnstile?.render === "function" ? window.turnstile : null;

const loadTurnstile = async () => {
	if (!loaded()) await loadScript(SCRIPT);
	const api = loaded();
	if (!api) throw new Error("Turnstile didn't load.");
	return api;
};

/**
 * The page's language as Turnstile names it. Turnstile falls back to English
 * for a region it doesn't list, such as `fr-CA`, so only the language is
 * passed, apart from Chinese, which it has as `zh-cn` and `zh-tw`.
 * `undefined` leaves Turnstile to follow the browser.
 */
const turnstileLanguage = (slot: Element) => {
	const lang = pageLanguage(slot).toLowerCase();
	if (!lang) return undefined;
	return lang.startsWith("zh-") ? lang : lang.split("-")[0];
};

/**
 * Cloudflare Turnstile. Pass it to `init`, and add a
 * `data-form--captcha="turnstile"` element with your `data-sitekey`:
 * `forms.init({ extensions: [turnstile] })`
 * - Turnstile's own `data-action`, `data-cdata`, `data-theme`, `data-size`, `data-appearance`, `data-language` and `data-response-field-name` attributes are passed on
 * - Without `data-language`, it follows the page's `lang`
 * - The token is sent as `cf-turnstile-response`, or the name in `data-response-field-name`
 */
export const turnstile = defineCaptcha("turnstile", (slot) => {
	const sitekey = siteKey(slot, "Turnstile");
	if (!sitekey) return null;
	const { dataset } = slot;
	const waitlist = createWaitlist();
	let api: TurnstileApi | null = null;
	let widgetId: string | null = null;
	let container: HTMLElement | null = null;
	let ready: Promise<void> | null = null;
	let destroyed = false;
	/** Whether the last check failed, so the next send starts it again rather than waiting */
	let failed = false;
	const pass = () => {
		if (destroyed) return;
		failed = false;
		waitlist.release();
	};
	const fail = () => {
		if (destroyed) return;
		failed = true;
		waitlist.release();
	};

	const start = () => {
		ready ??= loadTurnstile()
			.then((turnstile) => {
				if (destroyed) return;
				container = document.createElement("div");
				slot.append(container);
				const params: Record<string, unknown> = {
					sitekey,
					action: dataset.action,
					cData: dataset.cdata,
					theme: dataset.theme,
					size: dataset.size,
					appearance: dataset.appearance,
					language: dataset.language || turnstileLanguage(slot),
					"response-field-name": dataset.responseFieldName,
					callback: pass,
					"error-callback": fail,
					"timeout-callback": fail,
					"unsupported-callback": fail,
				};
				for (const key of Object.keys(params))
					if (params[key] === undefined) delete params[key];
				widgetId = turnstile.render(container, params) ?? null;
				if (widgetId !== null) api = turnstile;
			})
			// Sent without a token, which the server refuses with its own message. The next send loads it again.
			.catch(() => {
				ready = null;
				fail();
			});
		return ready;
	};

	return {
		start: () => void start(),
		token: async () => {
			await start();
			if (!api || widgetId === null) return;
			if (failed || api.isExpired(widgetId)) {
				failed = false;
				api.reset(widgetId);
			} else if (api.getResponse(widgetId)) return;
			await waitlist.wait();
		},
		reset: () => {
			if (api && widgetId !== null) api.reset(widgetId);
		},
		destroy: () => {
			destroyed = true;
			waitlist.release();
			if (api && widgetId !== null) api.remove(widgetId);
			container?.remove();
		},
	};
});
