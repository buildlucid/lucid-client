import { describe, expect, it, vi } from "vite-plus/test";
import forms from "../src/index.js";
import { recaptcha } from "../src/recaptcha.js";
import { turnstile } from "../src/turnstile.js";
import {
	$,
	$$,
	contactForm,
	mockFetch,
	requestOf,
	settle,
	submit,
	type,
} from "./utils.js";

const fill = () => {
	type("#name", "Ada");
	type("#email", "ada@example.com");
};

/** A fake Turnstile that passes its check when `pass` is called */
const fakeTurnstile = () => {
	let callback: (token: string) => void = () => {};
	let token = "";
	const api = {
		render: vi.fn((container: HTMLElement, params: Record<string, unknown>) => {
			callback = params.callback as typeof callback;
			const input = document.createElement("input");
			input.type = "hidden";
			input.name =
				(params["response-field-name"] as string) ?? "cf-turnstile-response";
			container.append(input);
			return "widget-1";
		}),
		reset: vi.fn(() => {
			token = "";
		}),
		remove: vi.fn(),
		getResponse: vi.fn(() => token),
		isExpired: vi.fn(() => false),
		pass: (value = "token") => {
			token = value;
			const input = document.querySelector<HTMLInputElement>(
				'[name="cf-turnstile-response"]',
			);
			if (input) input.value = value;
			callback(value);
		},
	};
	window.turnstile = api;
	return api;
};

describe("turnstile", () => {
	it("draws the widget once the form is used, and waits for its token", async () => {
		const fetch = mockFetch();
		const api = fakeTurnstile();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha="turnstile" data-sitekey="key" data-action="contact" data-theme="dark"></div>`,
		});
		forms.init({ extensions: [turnstile] });
		expect(api.render).not.toHaveBeenCalled();

		$("#name").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		await settle();
		expect(api.render).toHaveBeenCalledOnce();
		expect(api.render.mock.calls[0]?.[1]).toMatchObject({
			sitekey: "key",
			action: "contact",
			theme: "dark",
		});

		fill();
		submit();
		await settle();
		expect(fetch).not.toHaveBeenCalled();
		api.pass();
		await settle();
		expect(await requestOf(fetch).text()).toContain(
			"cf-turnstile-response=token",
		);
		expect(api.reset).toHaveBeenCalledOnce();

		forms.destroy();
		expect(api.remove).toHaveBeenCalledWith("widget-1");
		expect($("[data-form--captcha]").children).toHaveLength(0);
	});

	it("follows the page's language unless the widget sets its own", async () => {
		const api = fakeTurnstile();
		document.body.innerHTML = `<div lang="fr-CA">${contactForm({
			extra: `<div data-form--captcha="turnstile" data-sitekey="key"></div>`,
		})}</div>${contactForm({
			extra: `<div data-form--captcha="turnstile" data-sitekey="key" data-language="de"></div>`,
		}).replace(
			'data-form="contact" id="contact"',
			'data-form="other" id="other"',
		)}`;
		forms.init({ extensions: [turnstile] });
		for (const form of $$("form"))
			form.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		await settle();
		expect(api.render.mock.calls.map((call) => call[1]?.language)).toEqual([
			"fr",
			"de",
		]);
	});

	it("starts a failed check again on the next send, rather than waiting for it", async () => {
		const fetch = mockFetch();
		const api = fakeTurnstile();
		let error: () => void = () => {};
		api.render.mockImplementation((_container, params) => {
			error = params["error-callback"] as () => void;
			return "widget-1";
		});
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha="turnstile" data-sitekey="key"></div>`,
		});
		forms.init({ extensions: [turnstile] });
		$("#name").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
		await settle();
		error();
		fill();
		submit();
		await settle();
		expect(api.reset).toHaveBeenCalledWith("widget-1");
		expect(fetch).not.toHaveBeenCalled();
		error();
		await settle();
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("skips slots without a site key", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		fakeTurnstile();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha="turnstile"></div>`,
		});
		forms.init({ extensions: [turnstile] });
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("no data-sitekey"),
		);
	});
});

describe("recaptcha", () => {
	const fakeRecaptcha = () => {
		let callback: (token: string) => void = () => {};
		const api = {
			ready: (done: () => void) => done(),
			render: vi.fn(
				(_container: HTMLElement, params: Record<string, unknown>) => {
					callback = params.callback as typeof callback;
					return 0;
				},
			),
			reset: vi.fn(),
			execute: vi.fn(async () => "score-token"),
			getResponse: vi.fn(() => ""),
			tick: () => callback("checkbox-token"),
		};
		window.grecaptcha = api;
		return api;
	};

	it("waits for the checkbox to be ticked", async () => {
		const fetch = mockFetch();
		const api = fakeRecaptcha();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha="recaptcha" data-sitekey="key" data-response-field-name="_captcha"></div>`,
		});
		forms.init({ extensions: [recaptcha] });
		fill();
		submit();
		await settle();
		expect(api.render).toHaveBeenCalledOnce();
		expect(fetch).not.toHaveBeenCalled();
		api.tick();
		await settle();
		expect(await requestOf(fetch).text()).toContain("_captcha=checkbox-token");
		expect(api.reset).toHaveBeenCalledWith(0);
	});

	it("gets a fresh score token on every send", async () => {
		const fetch = mockFetch();
		const api = fakeRecaptcha();
		document.body.innerHTML = contactForm({
			extra: `<div data-form--captcha="recaptcha" data-sitekey="key" data-score data-action="contact"></div>`,
		});
		forms.init({ extensions: [recaptcha] });
		fill();
		submit();
		await settle();
		expect(api.render).not.toHaveBeenCalled();
		expect(api.execute).toHaveBeenCalledWith("key", { action: "contact" });
		expect(await requestOf(fetch).text()).toContain(
			"g-recaptcha-response=score-token",
		);
	});
});
